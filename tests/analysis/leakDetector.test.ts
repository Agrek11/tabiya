import { describe, expect, it } from 'vitest';
import { computeMcl, detectLeaks } from '../../src/analysis/leakDetector';
import type { GameAnalysis } from '../../src/types/analysis';

function mk(gameId: string, cpLosses: number[]): GameAnalysis {
  return {
    gameId,
    enginePreset: 'balanced',
    createdAt: 1,
    updatedAt: 1,
    plies: cpLosses.map((cpLoss, i) => ({ plyIndex: i, cpLoss })),
  };
}

describe('leakDetector', () => {
  it('computes MCL as mean positive cp-loss', () => {
    expect(computeMcl(mk('g', [20, -5, 0, 30]))).toBe(25);
  });

  it('flags keys that exceed thresholds', () => {
    const analyses = [mk('a1', [20, 30]), mk('a2', [10, 20]), mk('b1', [5])];
    const out = detectLeaks(analyses, (a) => (a.gameId.startsWith('a') ? 'A' : 'B'), {
      minMcl: 20,
      minGames: 2,
    });
    expect(out.find((x) => x.key === 'A')?.flagged).toBe(true);
    expect(out.find((x) => x.key === 'B')?.flagged).toBe(false);
  });
});
