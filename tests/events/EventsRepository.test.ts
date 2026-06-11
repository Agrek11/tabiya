/**
 * IndexedDbEventsRepository — contract tests.
 *
 * Uses fake-indexeddb. Covers append id assignment, all three read paths,
 * aggregate routing, clearAll, corrupt-record skip, and DST/timezone-edge
 * boundary behavior for listByDateRange.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

import { IndexedDbEventsRepository } from '../../src/storage/events/IndexedDbEventsRepository';
import { DB_NAME, DB_VERSION } from '../../src/storage/db/schema';
import { createEventsBus } from '../../src/storage/events/EventsBus';
import type { SessionEvent } from '../../src/types/events';

async function freshRepo(): Promise<IndexedDbEventsRepository> {
  // Reset fake-indexeddb between tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const factory = indexedDB as any;
  if (typeof factory._databases?.clear === 'function') {
    factory._databases.clear();
  } else {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('tabiya');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
  return new IndexedDbEventsRepository();
}

const T0 = new Date('2026-04-01T12:00:00Z').getTime();
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

describe('IndexedDbEventsRepository', () => {
  let repo: IndexedDbEventsRepository;

  beforeEach(async () => {
    repo = await freshRepo();
  });

  afterEach(() => {
    repo.resetDbCache();
  });

  it('append assigns autoincrement id', async () => {
    const e1 = await repo.append({
      timestamp: T0,
      eventType: 'line_start',
      lineId: 'a',
      plyIndex: null,
      durationMs: null,
    });
    const e2 = await repo.append({
      timestamp: T0 + 1,
      eventType: 'move_correct',
      lineId: 'a',
      plyIndex: 0,
      durationMs: 100,
    });
    expect(e1.id).toBe(1);
    expect(e2.id).toBe(2);
    expect(e1.lineId).toBe('a');
  });

  it('listByDateRange — empty', async () => {
    const out = await repo.listByDateRange(T0, T0 + ONE_DAY);
    expect(out).toEqual([]);
  });

  it('listByDateRange — inclusive from, exclusive to', async () => {
    await seedTriple(repo, T0);
    const out = await repo.listByDateRange(T0, T0 + 1);
    expect(out.map((e) => e.timestamp)).toEqual([T0]);
  });

  it('listByDateRange — cross-day window', async () => {
    await repo.append(mk(T0, 'a'));
    await repo.append(mk(T0 + ONE_DAY, 'a'));
    await repo.append(mk(T0 + 2 * ONE_DAY, 'a'));
    const out = await repo.listByDateRange(T0 + ONE_DAY, T0 + 2 * ONE_DAY + 1);
    expect(out).toHaveLength(2);
  });

  it('listByDateRange — DST-forward edge (event at 02:30 local on spring-forward day)', async () => {
    // We just verify the millisecond-based filter does not lose events near
    // the spring-forward instant — timezone arithmetic is the JS engine's
    // concern, not the repo's.
    const dstSpring = new Date('2026-03-08T07:30:00Z').getTime();
    await repo.append(mk(dstSpring, 'a'));
    const out = await repo.listByDateRange(dstSpring - 1, dstSpring + 1);
    expect(out).toHaveLength(1);
  });

  it('listByDateRange — DST-backward edge', async () => {
    const dstFall = new Date('2026-11-01T06:30:00Z').getTime();
    await repo.append(mk(dstFall, 'a'));
    const out = await repo.listByDateRange(dstFall, dstFall + 1);
    expect(out).toHaveLength(1);
  });

  it('listByLine — empty', async () => {
    const out = await repo.listByLine('nope');
    expect(out).toEqual([]);
  });

  it('listByLine — scoped to lineId, timestamp-ordered', async () => {
    await repo.append(mk(T0 + 2, 'a'));
    await repo.append(mk(T0 + 1, 'b'));
    await repo.append(mk(T0, 'a'));
    const out = await repo.listByLine('a');
    expect(out.map((e) => e.timestamp)).toEqual([T0, T0 + 2]);
  });

  it('aggregate — empty', async () => {
    const agg = await repo.aggregate({});
    expect(agg.totalMoves).toBe(0);
    expect(agg.correctMoves).toBe(0);
    expect(agg.accuracy).toBeNull();
  });

  it('aggregate — all correct', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.append(mk(T0 + i, 'a', 'move_correct'));
    }
    const agg = await repo.aggregate({});
    expect(agg.totalMoves).toBe(5);
    expect(agg.correctMoves).toBe(5);
    expect(agg.accuracy).toBe(1);
  });

  it('aggregate — mixed correct/wrong', async () => {
    for (let i = 0; i < 3; i++) await repo.append(mk(T0 + i, 'a', 'move_correct'));
    await repo.append(mk(T0 + 4, 'a', 'move_wrong'));
    const agg = await repo.aggregate({});
    expect(agg.totalMoves).toBe(4);
    expect(agg.correctMoves).toBe(3);
    expect(agg.accuracy).toBeCloseTo(0.75);
  });

  it('aggregate — per-line query routes through listByLine', async () => {
    await repo.append(mk(T0, 'a', 'move_correct'));
    await repo.append(mk(T0 + 1, 'a', 'move_wrong'));
    await repo.append(mk(T0 + 2, 'b', 'move_correct'));
    const agg = await repo.aggregate({ lineId: 'a' });
    expect(agg.totalMoves).toBe(2);
    expect(agg.correctMoves).toBe(1);
  });

  it('clearAll wipes events but preserves store/schema', async () => {
    await repo.append(mk(T0, 'a'));
    await repo.clearAll();
    expect(await repo.listAll()).toEqual([]);
    // Subsequent append still works.
    const next = await repo.append(mk(T0 + 1, 'a'));
    expect(next.id).toBeGreaterThan(0);
  });

  it('corrupt record skipped on listAll', async () => {
    await repo.append(mk(T0, 'a'));
    // Inject a corrupt row.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onsuccess = () => {
        const tx = req.result.transaction('session_events', 'readwrite');
        tx.objectStore('session_events').put({
          timestamp: 'NOT A NUMBER',
          eventType: 'line_start',
          lineId: 'corrupt',
          plyIndex: null,
          durationMs: null,
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
    const all = await repo.listAll();
    expect(all.map((e) => e.lineId)).toEqual(['a']);
  });

  it('event bus fires on append + clearAll when wrapped', async () => {
    const bus = createEventsBus();
    let count = 0;
    bus.subscribe(() => {
      count += 1;
    });
    // Manual wrap mirroring storage/index.ts.
    const wrapped = {
      async append(ev: Omit<SessionEvent, 'id'>) {
        const r = await repo.append(ev);
        bus.publish();
        return r;
      },
      async clearAll() {
        await repo.clearAll();
        bus.publish();
      },
    };
    await wrapped.append(mk(T0, 'a'));
    await wrapped.clearAll();
    // Bus coalesces within a frame — wait long enough.
    await new Promise((r) => setTimeout(r, 30));
    expect(count).toBeGreaterThan(0);
  });
});

function mk(
  ts: number,
  lineId: string,
  eventType: SessionEvent['eventType'] = 'line_start'
): Omit<SessionEvent, 'id'> {
  return {
    timestamp: ts,
    eventType,
    lineId,
    plyIndex: eventType.startsWith('move_') ? 0 : null,
    durationMs: null,
  };
}

async function seedTriple(
  repo: IndexedDbEventsRepository,
  base: number
): Promise<void> {
  await repo.append(mk(base, 'a'));
  await repo.append(mk(base + ONE_HOUR, 'a'));
  await repo.append(mk(base + 2 * ONE_HOUR, 'a'));
}
