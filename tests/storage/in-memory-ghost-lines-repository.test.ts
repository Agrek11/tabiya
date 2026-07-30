import { describe, expect, it } from 'vitest';
import { InMemoryGhostLineRepository } from '../../src/storage/ghost/InMemoryGhostLineRepository';
import type { GhostLineRecord } from '../../src/types/ghost';

const sample = (id: string, gameId: string, parent: string | null): GhostLineRecord => ({
  id,
  source: 'ghost',
  game_id: gameId,
  origin_ply: 5,
  parent_line_id: parent,
  cp_loss: 150,
  created_at: 1,
  opening_id: 'ghost',
  variation_id: 'ghost',
  name: id,
  moves: ['e4'],
  depth: 1,
  end_fen: '',
  popularity: 0,
  tags: [],
  strategic_notes: [],
  key_squares: [],
  forks: [],
});

describe('InMemoryGhostLineRepository', () => {
  it('stores and filters ghost lines', async () => {
    const repo = new InMemoryGhostLineRepository();
    await repo.put(sample('a', 'g1', 'line-1'));
    await repo.put(sample('b', 'g1', 'line-2'));
    await repo.put(sample('c', 'g2', 'line-1'));
    expect((await repo.listByGame('g1')).map((x) => x.id)).toEqual(['a', 'b']);
    expect((await repo.listByParentLine('line-1')).map((x) => x.id)).toEqual(['a', 'c']);
    await repo.remove('a');
    expect(await repo.get('a')).toBeNull();
  });
});
