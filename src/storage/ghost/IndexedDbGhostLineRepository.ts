import { openDB, type IDBPDatabase } from 'idb';
import type { GhostLineRecord } from '../../types/ghost';
import { DB_NAME, DB_VERSION, runMigrations, STORE_GHOST_LINES } from '../db/schema';
import type { GhostLineRepository } from './GhostLineRepository';

export class IndexedDbGhostLineRepository implements GhostLineRepository {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private getDb(): Promise<IDBPDatabase> {
    if (this.dbPromise === null) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, { upgrade: runMigrations });
    }
    return this.dbPromise;
  }

  async get(id: string): Promise<GhostLineRecord | null> {
    const db = await this.getDb();
    return ((await db.get(STORE_GHOST_LINES, id)) as GhostLineRecord | undefined) ?? null;
  }

  async put(record: GhostLineRecord): Promise<void> {
    const db = await this.getDb();
    await db.put(STORE_GHOST_LINES, record);
  }

  async listAll(): Promise<GhostLineRecord[]> {
    const db = await this.getDb();
    return (await db.getAll(STORE_GHOST_LINES)) as GhostLineRecord[];
  }

  async listByParentLine(parentLineId: string): Promise<GhostLineRecord[]> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_GHOST_LINES, 'readonly');
    const rows = await tx.store.index('by_parentLineId').getAll(parentLineId);
    await tx.done;
    return rows as GhostLineRecord[];
  }

  async listByGame(gameId: string): Promise<GhostLineRecord[]> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_GHOST_LINES, 'readonly');
    const rows = await tx.store.index('by_gameId').getAll(gameId);
    await tx.done;
    return rows as GhostLineRecord[];
  }

  async remove(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(STORE_GHOST_LINES, id);
  }

  async clearAll(): Promise<void> {
    const db = await this.getDb();
    await db.clear(STORE_GHOST_LINES);
  }

  resetDbCache(): void {
    this.dbPromise = null;
  }
}
