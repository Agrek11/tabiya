/**
 * IndexedDB-backed EventsRepository — Phase 1.5.
 *
 * Append-only log keyed by autoIncrement `id`. Reads tolerate corrupt records
 * (skipped + console.warned), mirroring `IndexedDbSrsRepository`'s defensive
 * pattern. The compound `lineId_timestamp` index serves the per-line ordered
 * read without an in-memory sort.
 *
 * All transactions are implicit (per-call). No multi-store transactions in
 * this phase — events and SRS are independent stores by design.
 */

import { openDB, type IDBPDatabase } from 'idb';
import {
  DB_NAME,
  DB_VERSION,
  STORE_EVENTS as STORE,
  runMigrations,
} from '../db/schema';
import type {
  AggregateResult,
  EventQuery,
  EventType,
  SessionEvent,
} from '../../types/events';
import { emptyAggregate } from '../../types/events';
import type { EventsRepository } from './EventsRepository';

export class IndexedDbEventsRepository implements EventsRepository {
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

  async append(ev: Omit<SessionEvent, 'id'>): Promise<SessionEvent> {
    const db = await this.getDb();
    const id = (await db.add(STORE, ev)) as number;
    return { ...ev, id };
  }

  async listByDateRange(
    fromMs: number,
    toMsExclusive: number
  ): Promise<SessionEvent[]> {
    const db = await this.getDb();
    const range = IDBKeyRange.bound(fromMs, toMsExclusive, false, true);
    const raw = (await db.getAllFromIndex(STORE, 'timestamp', range)) as unknown[];
    return raw.filter(isSessionEvent);
  }

  async listByLine(lineId: string): Promise<SessionEvent[]> {
    const db = await this.getDb();
    // Compound key range over [lineId, *] — use empty string and unicode max
    // to avoid IDB's reluctance to bound on Infinity for string keys.
    const range = IDBKeyRange.bound(
      [lineId, -Infinity],
      [lineId, Infinity]
    );
    const raw = (await db.getAllFromIndex(STORE, 'lineId_timestamp', range)) as unknown[];
    return raw.filter(isSessionEvent);
  }

  async listAll(): Promise<SessionEvent[]> {
    const db = await this.getDb();
    const raw = (await db.getAll(STORE)) as unknown[];
    const valid: SessionEvent[] = [];
    for (const r of raw) {
      if (isSessionEvent(r)) valid.push(r);
      else console.warn('Skipping corrupt SessionEvent record:', r);
    }
    return valid;
  }

  async aggregate(q: EventQuery): Promise<AggregateResult> {
    let events: SessionEvent[];
    if (q.lineId !== undefined) {
      events = await this.listByLine(q.lineId);
    } else if (q.from !== undefined && q.to !== undefined) {
      events = await this.listByDateRange(q.from, q.to);
    } else {
      events = await this.listAll();
    }
    return tally(events, q);
  }

  async clearAll(): Promise<void> {
    const db = await this.getDb();
    await db.clear(STORE);
  }
}

// ---------------------------------------------------------------------------
// Tally helper (pure)
// ---------------------------------------------------------------------------

export function tally(events: SessionEvent[], q: EventQuery): AggregateResult {
  const agg = emptyAggregate();
  const typeFilter =
    q.eventTypes !== undefined && q.eventTypes.length > 0
      ? new Set<EventType>(q.eventTypes)
      : null;
  // For per-line queries we still honor `from`/`to` if the caller passed them
  // (lineId path skips listByDateRange, so apply the time filter here).
  const fromMs = q.from;
  const toMsExclusive = q.to;

  for (const ev of events) {
    if (typeFilter !== null && !typeFilter.has(ev.eventType)) continue;
    if (fromMs !== undefined && ev.timestamp < fromMs) continue;
    if (toMsExclusive !== undefined && ev.timestamp >= toMsExclusive) continue;
    agg.countByType[ev.eventType] += 1;
    if (ev.eventType === 'move_correct') {
      agg.totalMoves += 1;
      agg.correctMoves += 1;
    } else if (ev.eventType === 'move_wrong') {
      agg.totalMoves += 1;
    }
  }
  agg.accuracy = agg.totalMoves === 0 ? null : agg.correctMoves / agg.totalMoves;
  return agg;
}

// ---------------------------------------------------------------------------
// Runtime type guard
// ---------------------------------------------------------------------------

const VALID_EVENT_TYPES: ReadonlySet<EventType> = new Set([
  'line_start',
  'move_correct',
  'move_wrong',
  'hint_used',
  'line_complete',
  'line_abandoned',
]);

export function isSessionEvent(value: unknown): value is SessionEvent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'number') return false;
  if (typeof v.timestamp !== 'number') return false;
  if (typeof v.lineId !== 'string') return false;
  if (typeof v.eventType !== 'string') return false;
  if (!VALID_EVENT_TYPES.has(v.eventType as EventType)) return false;
  if (v.plyIndex !== null && typeof v.plyIndex !== 'number') return false;
  if (v.durationMs !== null && typeof v.durationMs !== 'number') return false;
  return true;
}
