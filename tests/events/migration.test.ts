/**
 * Schema migration test — seeds a v1 DB with 3 SRS records, reopens at v2,
 * asserts SRS is preserved and the two new stores exist + are empty.
 *
 * R6.4 + R7.6.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';

import { runMigrations } from '../../src/storage/db/schema';
import { IndexedDbSrsRepository } from '../../src/storage/srs/IndexedDbSrsRepository';

const DB_NAME = 'tabiya';

async function wipe(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const factory = indexedDB as any;
  if (typeof factory._databases?.clear === 'function') {
    factory._databases.clear();
    return;
  }
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('schema migration v1 → v2', () => {
  beforeEach(async () => {
    await wipe();
  });

  afterEach(async () => {
    await wipe();
  });

  it('preserves seeded SRS records and creates new stores empty', async () => {
    // Seed a v1 DB manually with the Phase 1 schema only.
    const v1 = await openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('srs_state')) {
          const s = db.createObjectStore('srs_state', { keyPath: 'line_id' });
          s.createIndex('box', 'box', { unique: false });
        }
      },
    });
    const seeded = [
      {
        line_id: 'a',
        box: 1,
        last_reviewed: '2026-05-01T12:00:00Z',
        attempts: 1,
        wrong_attempts_total: 0,
        hint_uses_total: 0,
      },
      {
        line_id: 'b',
        box: 2,
        last_reviewed: '2026-05-02T12:00:00Z',
        attempts: 2,
        wrong_attempts_total: 1,
        hint_uses_total: 0,
      },
      {
        line_id: 'c',
        box: 3,
        last_reviewed: '2026-05-03T12:00:00Z',
        attempts: 3,
        wrong_attempts_total: 0,
        hint_uses_total: 1,
      },
    ];
    for (const s of seeded) await v1.put('srs_state', s);
    v1.close();

    // Reopen at v2 via the shared upgrade callback.
    const v2 = await openDB(DB_NAME, 2, { upgrade: runMigrations });

    // (a) srs_state retains all 3 records unchanged.
    const allSrs = await v2.getAll('srs_state');
    expect(allSrs).toHaveLength(3);
    expect(allSrs.map((r) => r.line_id).sort()).toEqual(['a', 'b', 'c']);
    expect(allSrs.find((r) => r.line_id === 'b').box).toBe(2);

    // (b) session_events exists and is empty.
    expect(v2.objectStoreNames.contains('session_events')).toBe(true);
    expect(await v2.getAll('session_events')).toEqual([]);

    // (c) repertoire_pick exists and is empty.
    expect(v2.objectStoreNames.contains('repertoire_pick')).toBe(true);
    expect(await v2.getAll('repertoire_pick')).toEqual([]);

    v2.close();

    // SRS repo still reads its records back through the public surface.
    const srs = new IndexedDbSrsRepository();
    const states = await srs.listAllStates();
    expect(states).toHaveLength(3);
  });
});
