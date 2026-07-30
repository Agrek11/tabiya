import { describe, expect, it } from 'vitest';
import { selectGhostCandidates } from '../../src/analysis/ghostCandidates';
import type { GameAnalysis } from '../../src/types/analysis';

function sample(): GameAnalysis {
  return {
    gameId: 'g1',
    enginePreset: 'balanced',
    createdAt: 1,
    updatedAt: 1,
    plies: [
      { plyIndex: 3, san: 'Nc3', bestmove: 'Nf3', cpLoss: 30 },
      { plyIndex: 5, san: 'h3', bestmove: 'd4', cpLoss: 160 },
      { plyIndex: 7, san: 'a3', bestmove: 'Be3', cpLoss: 180 },
      { plyIndex: 11, san: 'Qe2', bestmove: '0-0', cpLoss: 140 },
    ],
  };
}

describe('selectGhostCandidates', () => {
  it('picks thresholded candidates with cooldown suppression', () => {
    const out = selectGhostCandidates(sample(), { minCpLoss: 120, cooldownPlies: 4 });
    expect(out.map((x) => x.plyIndex)).toEqual([5, 11]);
  });
});
