/**
 * Shared IndexedDB schema for the tabiya app.
 *
 * Phase 1 lived inline inside `IndexedDbSrsRepository`. Phase 1.5 hoists the
 * schema here so that the SRS repo and the new Events + Repertoire repos all
 * open the same DB through the same upgrade callback (Article 5 — one seam,
 * two stores added without rewriting either repo).
 *
 * Migration is strictly additive — no `deleteObjectStore`, no mutation of
 * existing stores. Each `oldVersion <` block guards every `createObjectStore`
 * with `objectStoreNames.contains` so re-entry is idempotent.
 *
 * Test coverage: `tests/events/migration.spec.ts` seeds a v1 DB and asserts
 * a clean v2 upgrade preserves the SRS rows.
 */

import type { IDBPDatabase, IDBPTransaction } from 'idb';

export const DB_NAME = 'tabiya';
export const DB_VERSION = 3;

export const STORE_SRS = 'srs_state';
export const STORE_EVENTS = 'session_events';
export const STORE_REPERTOIRE = 'repertoire_pick';
export const STORE_LICHESS_GAMES = 'lichess_games';
export const STORE_LICHESS_OOB = 'lichess_oob_events';

/** Out-of-line key used by the single-row repertoire pick store. */
export const REPERTOIRE_KEY = 'current';

/**
 * idb's `upgrade` callback signature. We accept the transaction param even
 * though we don't currently use it — required when crossing versions during
 * the same `openDB` call so callers can safely thread the same callback in.
 */
export function runMigrations(
  db: IDBPDatabase,
  oldVersion: number,
  _newVersion: number | null,
  _tx: IDBPTransaction<unknown, string[], 'versionchange'>
): void {
  // v0 -> v1: SRS state (Phase 1).
  if (oldVersion < 1) {
    if (!db.objectStoreNames.contains(STORE_SRS)) {
      const s = db.createObjectStore(STORE_SRS, { keyPath: 'line_id' });
      s.createIndex('box', 'box', { unique: false });
    }
  }
  // v1 -> v2: session_events + repertoire_pick (Phase 1.5).
  if (oldVersion < 2) {
    if (!db.objectStoreNames.contains(STORE_EVENTS)) {
      const s = db.createObjectStore(STORE_EVENTS, {
        keyPath: 'id',
        autoIncrement: true,
      });
      s.createIndex('timestamp', 'timestamp', { unique: false });
      s.createIndex('lineId', 'lineId', { unique: false });
      s.createIndex('eventType', 'eventType', { unique: false });
      s.createIndex('lineId_timestamp', ['lineId', 'timestamp'], { unique: false });
    }
    if (!db.objectStoreNames.contains(STORE_REPERTOIRE)) {
      // Out-of-line keys — we always read/write at REPERTOIRE_KEY.
      db.createObjectStore(STORE_REPERTOIRE);
    }
  }
  // v2 -> v3: lichess_games + lichess_oob_events (Phase 3).
  if (oldVersion < 3) {
    if (!db.objectStoreNames.contains(STORE_LICHESS_GAMES)) {
      const s = db.createObjectStore(STORE_LICHESS_GAMES, { keyPath: 'id' });
      s.createIndex('by_createdAt', 'createdAt', { unique: false });
    }
    if (!db.objectStoreNames.contains(STORE_LICHESS_OOB)) {
      const s = db.createObjectStore(STORE_LICHESS_OOB, {
        keyPath: ['gameId', 'plyIndex'],
      });
      s.createIndex('by_detectedAt', 'detectedAt', { unique: false });
      s.createIndex('by_lineId', 'lineId', { unique: false });
    }
  }
}
