import { describe, expect, it } from 'vitest';
import type { GameAnalysis } from '../../src/types/analysis';
import { synthesizeGhostLine } from '../../src/analysis/ghostLineSynth';

const ANALYSIS: GameAnalysis = {
  gameId: 'g-123',
  enginePreset: 'balanced',
  createdAt: 1,
  updatedAt: 1,
  plies: [
    { plyIndex: 0, san: 'e4', fenAfter: 'fen-1', cpLoss: 0 },
    { plyIndex: 1, san: 'e5', fenAfter: 'fen-2', cpLoss: 0 },
    { plyIndex: 2, san: 'Nf3', fenAfter: 'fen-3', cpLoss: 0 },
    { plyIndex: 3, san: 'Nc6', fenAfter: 'fen-4', cpLoss: 0 },
    { plyIndex: 4, san: 'Bb5', fenAfter: 'fen-5', cpLoss: 160, bestmove: 'Bc4' },
  ],
};

describe('synthesizeGhostLine', () => {
  it('builds deterministic line with fork annotation', () => {
    const ghost = synthesizeGhostLine(
      ANALYSIS,
      {
        gameId: 'g-123',
        plyIndex: 4,
        playedSan: 'Bb5',
        bestSan: 'Bc4',
        cpLoss: 160,
      },
      { parentLineId: 'italian-main' },
    );
    expect(ghost.id).toBe('ghost:italian-main:g-123:4');
    expect(ghost.moves).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    expect(ghost.forks[0]?.alternatives).toEqual(['Bb5']);
    expect(ghost.tags).toContain('ghost-line');
    expect(ghost.source).toBe('ghost');
  });
});
