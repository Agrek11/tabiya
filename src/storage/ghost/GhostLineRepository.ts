import type { GhostLineRecord } from '../../types/ghost';

export interface GhostLineRepository {
  get(id: string): Promise<GhostLineRecord | null>;
  put(record: GhostLineRecord): Promise<void>;
  listAll(): Promise<GhostLineRecord[]>;
  listByParentLine(parentLineId: string): Promise<GhostLineRecord[]>;
  listByGame(gameId: string): Promise<GhostLineRecord[]>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
  resetDbCache?(): void;
}
