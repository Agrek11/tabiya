/**
 * IndexedDb integration tests using `fake-indexeddb`. No real browser.
 *
 * Re-uses the same contract as InMemorySrsRepository tests, plus a
 * round-trip-after-close test and a corrupt-record skip test.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

import { IndexedDbSrsRepository } from '../src/storage/srs/IndexedDbSrsRepository';
import type { DrillResult } from '../src/storage/types';

const baseResult: DrillResult = {
  wrong_attempts: 0,
  hint_uses: 0,
  duration_ms: 1000,
  completed_at: '2026-05-09T12:00:00Z',
};

async function freshRepo(): Promise<IndexedDbSrsRepository> {
  // Wipe any leftover DB between tests. fake-indexeddb supports a synchronous
  // reset via the `IDBFactory` global from the auto-import. Falling back to
  // deleteDatabase if reset is unavailable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const factory = indexedDB as any;
  if (typeof factory._databases?.clear === 'function') {
    factory._databases.clear();
  } else {
    // Last-resort: delete by name with a hard timeout so a misbehaving fake
    // doesn't hang the suite.
    await Promise.race([
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('tabiya');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 100)),
    ]);
  }
  return new IndexedDbSrsRepository();
}

describe('IndexedDbSrsRepository', () => {
  let repo: IndexedDbSrsRepository;

  beforeEach(async () => {
    repo = await freshRepo();
  });

  afterEach(() => {
    repo.resetDbCache();
  });

  it('opens DB and creates store on first call', async () => {
    expect(await repo.listAllStates()).toEqual([]);
  });

  it('write then read in same session', async () => {
    await repo.recordDrillResult('ruy-lopez-main', baseResult);
    const s = await repo.getState('ruy-lopez-main');
    expect(s?.line_id).toBe('ruy-lopez-main');
    expect(s?.box).toBe(2);
  });

  it('round-trip across DB close/reopen', async () => {
    await repo.recordDrillResult('a', baseResult);
    repo.resetDbCache(); // simulates app reload
    const s = await repo.getState('a');
    expect(s?.line_id).toBe('a');
    expect(s?.box).toBe(2);
  });

  it('listAllStates returns all written records', async () => {
    await repo.recordDrillResult('a', baseResult);
    await repo.recordDrillResult('b', baseResult);
    await repo.recordDrillResult('c', baseResult);
    const all = await repo.listAllStates();
    expect(all.map((s) => s.line_id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('resetState removes one record', async () => {
    await repo.recordDrillResult('a', baseResult);
    await repo.recordDrillResult('b', baseResult);
    await repo.resetState('a');
    expect(await repo.getState('a')).toBeNull();
    expect(await repo.getState('b')).not.toBeNull();
  });

  it('resetAll empties the store', async () => {
    await repo.recordDrillResult('a', baseResult);
    await repo.recordDrillResult('b', baseResult);
    await repo.resetAll();
    expect(await repo.listAllStates()).toEqual([]);
  });

  it('promotion progression across multiple drills', async () => {
    const s1 = await repo.recordDrillResult('x', baseResult); // Box 2
    expect(s1.box).toBe(2);
    const s2 = await repo.recordDrillResult('x', baseResult); // Box 3
    expect(s2.box).toBe(3);
    const s3 = await repo.recordDrillResult('x', baseResult); // Box 4
    expect(s3.box).toBe(4);
  });

  it('corrupt record skipped on listAllStates', async () => {
    // First ensure the repo has opened the DB so the store exists.
    await repo.recordDrillResult('valid', baseResult);
    // Inject a corrupt record through the underlying IDB.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('tabiya', 1);
      req.onsuccess = () => {
        const tx = req.result.transaction('srs_state', 'readwrite');
        tx.objectStore('srs_state').put({
          line_id: 'corrupt',
          box: 'not-a-number',
          last_reviewed: '2026-05-09T12:00:00Z',
        });
        tx.oncomplete = () => {
          req.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    repo.resetDbCache();
    const all = await repo.listAllStates();
    // Only the valid record survives.
    expect(all.map((s) => s.line_id)).toEqual(['valid']);
  });
});
