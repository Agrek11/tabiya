/**
 * IndexedDB-backed RepertoireRepository — single-row pick.
 *
 * One row, out-of-line key `'current'`. Reads tolerate a missing row
 * (returning DEFAULT_PICK) and corrupt shapes (returning DEFAULT_PICK with a
 * console.warn) — corruption resilience mirrors the SRS + events repos.
 */

import { openDB, type IDBPDatabase } from 'idb';
import {
  DB_NAME,
  DB_VERSION,
  STORE_REPERTOIRE as STORE,
  REPERTOIRE_KEY as KEY,
  runMigrations,
} from '../db/schema';
import { DEFAULT_PICK, type RepertoirePick } from '../../types/repertoire';
import type { RepertoireRepository } from './RepertoireRepository';

export class IndexedDbRepertoireRepository implements RepertoireRepository {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private getDb(): Promise<IDBPDatabase> {
    if (this.dbPromise === null) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, { upgrade: runMigrations });
    }
    return this.dbPromise;
  }

  resetDbCache(): void {
    this.dbPromise = null;
  }

  async getPick(): Promise<RepertoirePick> {
    const db = await this.getDb();
    const raw = await db.get(STORE, KEY);
    if (raw === undefined) return { ...DEFAULT_PICK };
    if (!isRepertoirePick(raw)) {
      console.warn('Skipping corrupt RepertoirePick record:', raw);
      return { ...DEFAULT_PICK };
    }
    return raw;
  }

  async savePick(pick: RepertoirePick): Promise<void> {
    const db = await this.getDb();
    await db.put(STORE, pick, KEY);
  }

  async resetPick(): Promise<void> {
    const db = await this.getDb();
    await db.delete(STORE, KEY);
  }
}

function isRepertoirePick(value: unknown): value is RepertoirePick {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.presetId !== 'string') return false;
  if (!Array.isArray(v.additions)) return false;
  if (!Array.isArray(v.removals)) return false;
  return (
    v.additions.every((x) => typeof x === 'string') &&
    v.removals.every((x) => typeof x === 'string')
  );
}
