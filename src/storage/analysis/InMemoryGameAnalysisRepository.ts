import type { GameAnalysis } from '../../types/analysis';
import type { GameAnalysisRepository } from './GameAnalysisRepository';

function key(gameId: string, enginePreset: string): string {
  return `${gameId}::${enginePreset}`;
}

export class InMemoryGameAnalysisRepository implements GameAnalysisRepository {
  private readonly byKey = new Map<string, GameAnalysis>();

  async get(gameId: string, enginePreset: string): Promise<GameAnalysis | null> {
    return this.byKey.get(key(gameId, enginePreset)) ?? null;
  }

  async put(record: GameAnalysis): Promise<void> {
    this.byKey.set(key(record.gameId, record.enginePreset), record);
  }

  async listByGame(gameId: string): Promise<GameAnalysis[]> {
    return [...this.byKey.values()].filter((r) => r.gameId === gameId);
  }

  async listAll(): Promise<GameAnalysis[]> {
    return [...this.byKey.values()];
  }

  async clearAll(): Promise<void> {
    this.byKey.clear();
  }
}
