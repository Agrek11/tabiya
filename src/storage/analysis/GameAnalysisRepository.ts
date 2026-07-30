import type { GameAnalysis } from '../../types/analysis';

export interface GameAnalysisRepository {
  get(gameId: string, enginePreset: string): Promise<GameAnalysis | null>;
  put(record: GameAnalysis): Promise<void>;
  listByGame(gameId: string): Promise<GameAnalysis[]>;
  listAll(): Promise<GameAnalysis[]>;
  clearAll(): Promise<void>;
  resetDbCache?(): void;
}
