/**
 * IndexedDB-backed SrsRepository — Phase 1 v1 implementation.
 *
 * Single tabiya DB, store name `srs_state`, key path `line_id`. Future
 * Phase 1.5 will bump version to 2 and add `session_events`; the upgrade
 * callback in `openDatabase` is the only place that needs to change.
 *
 * Reads tolerate corrupt records (skipped + console.warned). Writes
 * roundtrip through `nextSrsState` so promotion math is identical to
 * the in-memory impl.
 */

import { openDB, type IDBPDatabase } from 'idb';
import { nextSrsState } from './scheduler';
import type { DrillResult, SrsBox, SrsRepository, SrsState } from '../types';

const DB_NAME = 'tabiya';
const DB_VERSION = 1;
const STORE = 'srs_state';

export class IndexedDbSrsRepository implements SrsRepository {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private getDb(): Promise<IDBPDatabase> {
    if (this.dbPromise === null) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, { keyPath: 'line_id' });
            store.createIndex('box', 'box', { unique: false });
          }
        },
      });
    }
    return this.dbPromise;
  }

  /** Test escape hatch — drop the cached DB promise so a re-mocked global
   *  indexedDB takes effect on the next call. */
  resetDbCache(): void {
    this.dbPromise = null;
  }

  async getState(lineId: string): Promise<SrsState | null> {
    const db = await this.getDb();
    const raw = await db.get(STORE, lineId);
    if (raw === undefined) return null;
    return isSrsState(raw) ? raw : null;
  }

  async listAllStates(): Promise<SrsState[]> {
    const db = await this.getDb();
    const all = await db.getAll(STORE);
    const valid: SrsState[] = [];
    for (const raw of all) {
      if (isSrsState(raw)) {
        valid.push(raw);
      } else {
        console.warn('Skipping corrupt SrsState record:', raw);
      }
    }
    return valid;
  }

  async recordDrillResult(lineId: string, result: DrillResult): Promise<SrsState> {
    const prev = await this.getState(lineId);
    const computed = nextSrsState(prev, result);
    const next: SrsState = { ...computed, line_id: lineId };
    const db = await this.getDb();
    await db.put(STORE, next);
    return next;
  }

  async resetState(lineId: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(STORE, lineId);
  }

  async resetAll(): Promise<void> {
    const db = await this.getDb();
    await db.clear(STORE);
  }
}

// ---------------------------------------------------------------------------
// Runtime type guard
// ---------------------------------------------------------------------------

function isSrsState(value: unknown): value is SrsState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.line_id === 'string' &&
    isBox(v.box) &&
    typeof v.last_reviewed === 'string' &&
    typeof v.attempts === 'number' &&
    typeof v.wrong_attempts_total === 'number' &&
    typeof v.hint_uses_total === 'number'
  );
}

function isBox(value: unknown): value is SrsBox {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}
