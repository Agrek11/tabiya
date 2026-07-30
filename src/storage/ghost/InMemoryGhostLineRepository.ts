import type { GhostLineRecord } from '../../types/ghost';
import type { GhostLineRepository } from './GhostLineRepository';

export class InMemoryGhostLineRepository implements GhostLineRepository {
  private readonly byId = new Map<string, GhostLineRecord>();

  async get(id: string): Promise<GhostLineRecord | null> {
    return this.byId.get(id) ?? null;
  }

  async put(record: GhostLineRecord): Promise<void> {
    this.byId.set(record.id, record);
  }

  async listAll(): Promise<GhostLineRecord[]> {
    return [...this.byId.values()];
  }

  async listByParentLine(parentLineId: string): Promise<GhostLineRecord[]> {
    return [...this.byId.values()].filter((r) => r.parent_line_id === parentLineId);
  }

  async listByGame(gameId: string): Promise<GhostLineRecord[]> {
    return [...this.byId.values()].filter((r) => r.game_id === gameId);
  }

  async remove(id: string): Promise<void> {
    this.byId.delete(id);
  }

  async clearAll(): Promise<void> {
    this.byId.clear();
  }
}
