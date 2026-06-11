/**
 * IndexedDB-backed LichessRepository (R4) — same `tabiya` DB as SRS/events,
 * stores added by the v3 migration in src/storage/db/schema.ts. Mirrors the
 * `IndexedDbSrsRepository` open/cache pattern.
 */

import { openDB, type IDBPDatabase } from 'idb';
import {
  DB_NAME,
  DB_VERSION,
  STORE_LICHESS_GAMES,
  STORE_LICHESS_OOB,
  runMigrations,
} from '../../storage/db/schema';
import type { LichessRepository } from './repository';
import { gameSource, type GameSource, type LichessGame, type OOBEvent } from './types';

export class IdbLichessRepository implements LichessRepository {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private getDb(): Promise<IDBPDatabase> {
    if (this.dbPromise === null) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, { upgrade: runMigrations });
    }
    return this.dbPromise;
  }

  /** Test escape hatch — see IndexedDbSrsRepository.resetDbCache. */
  resetDbCache(): void {
    this.dbPromise = null;
  }

  async getGame(gameId: string): Promise<LichessGame | null> {
    const db = await this.getDb();
    return ((await db.get(STORE_LICHESS_GAMES, gameId)) as LichessGame | undefined) ?? null;
  }

  async putGame(game: LichessGame): Promise<void> {
    const db = await this.getDb();
    const existing = (await db.get(STORE_LICHESS_GAMES, game.id)) as LichessGame | undefined;
    if (existing && existing.importedAt >= game.importedAt) return; // idempotent no-op (R4 AC6)
    await db.put(STORE_LICHESS_GAMES, game);
  }

  async listGames(opts: { since?: number; limit?: number } = {}): Promise<LichessGame[]> {
    const db = await this.getDb();
    const all = (await db.getAll(STORE_LICHESS_GAMES)) as LichessGame[];
    const filtered = opts.since !== undefined ? all.filter((g) => g.createdAt >= opts.since!) : all;
    filtered.sort((a, b) => b.createdAt - a.createdAt);
    return opts.limit !== undefined ? filtered.slice(0, opts.limit) : filtered;
  }

  async markGameChecked(gameId: string): Promise<void> {
    const db = await this.getDb();
    const game = (await db.get(STORE_LICHESS_GAMES, gameId)) as LichessGame | undefined;
    if (!game) return;
    await db.put(STORE_LICHESS_GAMES, { ...game, oobChecked: true });
  }

  async getOOBEvents(
    opts: { limit?: number; offset?: number; gameId?: string } = {},
  ): Promise<OOBEvent[]> {
    const db = await this.getDb();
    let events = (await db.getAll(STORE_LICHESS_OOB)) as OOBEvent[];
    if (opts.gameId !== undefined) events = events.filter((e) => e.gameId === opts.gameId);
    events.sort((a, b) => b.detectedAt - a.detectedAt);
    const start = opts.offset ?? 0;
    const end = opts.limit !== undefined ? start + opts.limit : undefined;
    return events.slice(start, end);
  }

  async putOOBEvent(event: OOBEvent): Promise<void> {
    const db = await this.getDb();
    await db.put(STORE_LICHESS_OOB, event); // composite-key upsert (R4 AC6)
  }

  async clearAll(): Promise<void> {
    const db = await this.getDb();
    await db.clear(STORE_LICHESS_GAMES);
    await db.clear(STORE_LICHESS_OOB);
  }

  async clearSource(source: GameSource): Promise<void> {
    const db = await this.getDb();
    const games = (await db.getAll(STORE_LICHESS_GAMES)) as LichessGame[];
    const doomed = games.filter((g) => gameSource(g) === source);
    const doomedIds = new Set(doomed.map((g) => g.id));
    for (const g of doomed) await db.delete(STORE_LICHESS_GAMES, g.id);
    const events = (await db.getAll(STORE_LICHESS_OOB)) as OOBEvent[];
    for (const e of events) {
      if (doomedIds.has(e.gameId)) await db.delete(STORE_LICHESS_OOB, [e.gameId, e.plyIndex]);
    }
  }
}
