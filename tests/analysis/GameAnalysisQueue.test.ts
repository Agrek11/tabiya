import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameAnalysisQueue } from '../../src/analysis/GameAnalysisQueue';
import { _setGameAnalysisRepositoryForTesting, InMemoryGameAnalysisRepository } from '../../src/storage';

const analyzeMock = vi.fn();

vi.mock('../../src/engine/engineLoader', () => ({
  loadStockfishEngine: async () => ({ analyze: analyzeMock }),
}));

vi.mock('../../src/engine/presets', () => ({
  getEnginePreset: () => ({ depth: 8, multipv: 1, movetimeMs: 10 }),
}));

describe('GameAnalysisQueue', () => {
  beforeEach(() => {
    analyzeMock.mockReset();
    analyzeMock.mockResolvedValue({
      fen: 'x',
      bestmove: 'Nf3',
      pvs: [{ moves: ['Nf3'], scoreCp: 20, depth: 8 }],
      engineName: 'sf',
      engineDepth: 8,
    });
    _setGameAnalysisRepositoryForTesting(new InMemoryGameAnalysisRepository());
  });

  it('coalesces duplicate in-flight requests by key', async () => {
    const q = new GameAnalysisQueue();
    const input = {
      gameId: 'g1',
      pgn: '1. e4 e5 2. Nf3 Nc6',
      enginePreset: 'balanced' as const,
      maxPlies: 2,
    };
    const [a, b] = await Promise.all([q.enqueue(input), q.enqueue(input)]);
    expect(a.gameId).toBe('g1');
    expect(b.gameId).toBe('g1');
    expect(analyzeMock).toHaveBeenCalledTimes(4);
  });

  it('does not coalesce different engine presets', async () => {
    const q = new GameAnalysisQueue();
    const pgn = '1. e4 e5';
    await Promise.all([
      q.enqueue({ gameId: 'g2', pgn, enginePreset: 'balanced', maxPlies: 1 }),
      q.enqueue({ gameId: 'g2', pgn, enginePreset: 'fast', maxPlies: 1 }),
    ]);
    expect(analyzeMock).toHaveBeenCalledTimes(4);
  });

  it('returns cached analysis without re-running engine', async () => {
    const repo = new InMemoryGameAnalysisRepository();
    _setGameAnalysisRepositoryForTesting(repo);
    await repo.put({
      gameId: 'g3',
      enginePreset: 'balanced',
      createdAt: 1,
      updatedAt: 1,
      plies: [{ plyIndex: 0, san: 'e4', bestmove: 'e4', cpLoss: 0 }],
    });
    const q = new GameAnalysisQueue();
    const out = await q.enqueue({
      gameId: 'g3',
      pgn: '1. e4 e5',
      enginePreset: 'balanced',
      maxPlies: 1,
    });
    expect(out.gameId).toBe('g3');
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it('can cancel a queued (not yet running) duplicate key', async () => {
    let releaseFirst: (() => void) | null = null;
    analyzeMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          if (releaseFirst === null) {
            releaseFirst = () =>
              resolve({
                fen: 'x',
                bestmove: 'Nf3',
                pvs: [{ moves: ['Nf3'], scoreCp: 20, depth: 8 }],
                engineName: 'sf',
                engineDepth: 8,
              });
          } else {
            resolve({
              fen: 'x',
              bestmove: 'Nf3',
              pvs: [{ moves: ['Nf3'], scoreCp: 20, depth: 8 }],
              engineName: 'sf',
              engineDepth: 8,
            });
          }
        }),
    );
    const q = new GameAnalysisQueue();
    const first = q.enqueue({
      gameId: 'blocker',
      pgn: '1. e4 e5',
      enginePreset: 'balanced',
      maxPlies: 1,
    });
    const second = q.enqueue({
      gameId: 'target',
      pgn: '1. d4 d5',
      enginePreset: 'balanced',
      maxPlies: 1,
    });
    await vi.waitFor(() => expect(releaseFirst).not.toBeNull());
    q.cancel('target', 'balanced');
    releaseFirst?.();
    await first;
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
  });
});
