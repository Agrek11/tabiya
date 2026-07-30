import { describe, expect, it } from 'vitest';
import { clusterGhostBlunders } from '../../src/analysis/blunderDna';
import type { GhostLineRecord } from '../../src/types/ghost';

function ghost(id: string, played: string, best: string): GhostLineRecord {
  return {
    id,
    source: 'ghost',
    game_id: 'g',
    origin_ply: 4,
    parent_line_id: null,
    cp_loss: 160,
    created_at: 1,
    opening_id: 'ghost',
    variation_id: 'ghost',
    name: id,
    moves: ['e4', 'e5', best],
    depth: 3,
    end_fen: '',
    popularity: 0,
    tags: ['ghost-line'],
    strategic_notes: [],
    key_squares: [],
    forks: [{ ply_index: 2, alternatives: [played], label: 'played' }],
  };
}

describe('clusterGhostBlunders', () => {
  it('clusters deterministic blunder motifs', () => {
    const out = clusterGhostBlunders([
      ghost('1', 'Qh5', 'Nf3'),
      ghost('2', 'h4', 'Nf3'),
      ghost('3', 'axb5', 'O-O'),
    ]);
    expect(out[0]?.count).toBeGreaterThan(0);
    expect(out.map((x) => x.label)).toContain('Early Queen Commitment');
    expect(out.map((x) => x.label)).toContain('Edge/Wing Pawn Drift');
  });
});
