/**
 * renderFeaturesBlock — Phase 4b. Emits ONLY notable facts (token discipline)
 * and never invents; an all-default position yields ''.
 */

import { describe, expect, it } from 'vitest';
import { renderFeaturesBlock } from '../../src/coach/features/renderFeaturesBlock';
import type { PositionFeatures } from '../../src/coach/features/PositionFeatures';

function base(): PositionFeatures {
  return {
    version: 2,
    material: { balance_cp: 0, imbalance: 'none', bishop_pair: { white: false, black: false } },
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

describe('renderFeaturesBlock', () => {
  it('returns empty string when nothing is notable', () => {
    expect(renderFeaturesBlock(base())).toBe('');
  });

  it('renders isolated pawns, an outpost square, and a pin — and nothing else', () => {
    const f = base();
    f.pawns.isolated.white = ['d4'];
    f.activity.outposts.white.available = ['d5'];
    f.tactics_geometry.pins = [{ pinned: 'Nf6', to: 'Qd8', by: 'Bg5', absolute: false }];
    const block = renderFeaturesBlock(f);
    expect(block).toContain('Pawns: white isolated pawns: d4');
    expect(block).toContain('outpost square(s) d5');
    expect(block).toContain('relative pin: Bg5 pins Nf6 to Qd8');
    expect(block).not.toContain('King safety'); // uncastled-only → suppressed
    expect(block).not.toContain('Material'); // no imbalance, no single bishop pair
  });

  it('flags a single-side bishop pair and an IQP', () => {
    const f = base();
    f.material.bishop_pair.white = true;
    f.pawns.iqp = 'black';
    const block = renderFeaturesBlock(f);
    expect(block).toContain('white has the bishop pair');
    expect(block).toContain("black has an isolated queen's pawn");
  });

  it('reports an absolute pin distinctly', () => {
    const f = base();
    f.tactics_geometry.pins = [{ pinned: 'Nf6', to: 'Kd8', by: 'Bg5', absolute: true }];
    expect(renderFeaturesBlock(f)).toContain('absolute pin: Bg5 pins Nf6 to Kd8');
  });
});
