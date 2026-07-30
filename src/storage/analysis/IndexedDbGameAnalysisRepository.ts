import { openDB, type IDBPDatabase } from 'idb';
import type { GameAnalysis } from '../../types/analysis';
import {
  DB_NAME,
  DB_VERSION,
  runMigrations,
  STORE_GAME_ANALYSIS,
} from '../db/schema';
import type { GameAnalysisRepository } from './GameAnalysisRepository';

type Row = GameAnalysis & { id: string };

function key(gameId: string, enginePreset: string): string {
  return `${gameId}::${enginePreset}`;
}

export class IndexedDbGameAnalysisRepository implements GameAnalysisRepository {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private getDb(): Promise<IDBPDatabase> {
    if (this.dbPromise === null) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, { upgrade: runMigrations });
    }
    return this.dbPromise;
  }

  async get(gameId: string, enginePreset: string): Promise<GameAnalysis | null> {
    const db = await this.getDb();
    const row = (await db.get(STORE_GAME_ANALYSIS, key(gameId, enginePreset))) as Row | undefined;
    if (!row) return null;
    return {
      gameId: row.gameId,
      enginePreset: row.enginePreset,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      plies: row.plies,
    };
  }

  async put(record: GameAnalysis): Promise<void> {
    const db = await this.getDb();
    const row: Row = { ...record, id: key(record.gameId, record.enginePreset) };
    await db.put(STORE_GAME_ANALYSIS, row);
  }

  async listByGame(gameId: string): Promise<GameAnalysis[]> {
    const db = await this.getDb();
    const idx = db.transaction(STORE_GAME_ANALYSIS, 'readonly').store.index('by_game');
    const rows = (await idx.getAll(gameId)) as Row[];
    return rows.map((r) => ({
      gameId: r.gameId,
      enginePreset: r.enginePreset,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      plies: r.plies,
    }));
  }

  async listAll(): Promise<GameAnalysis[]> {
    const db = await this.getDb();
    const rows = (await db.getAll(STORE_GAME_ANALYSIS)) as Row[];
    return rows.map((r) => ({
      gameId: r.gameId,
      enginePreset: r.enginePreset,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      plies: r.plies,
    }));
  }

  async clearAll(): Promise<void> {
    const db = await this.getDb();
    await db.clear(STORE_GAME_ANALYSIS);
  }

  resetDbCache(): void {
    this.dbPromise = null;
  }
}
