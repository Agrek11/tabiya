/**
 * In-memory EventsRepository — exclusively for tests + SSR fallback.
 *
 * Same surface as `IndexedDbEventsRepository`. Append assigns a monotonic
 * id starting at 1. `aggregate` reuses the pure `tally` helper so behavior
 * is identical to the IDB path.
 */

import type {
  AggregateResult,
  EventQuery,
  SessionEvent,
} from '../../types/events';
import type { EventsRepository } from './EventsRepository';
import { tally } from './IndexedDbEventsRepository';

export class InMemoryEventsRepository implements EventsRepository {
  private events: SessionEvent[] = [];
  private nextId = 1;

  resetDbCache(): void {
    /* no-op for parity with IDB impl */
  }

  /** Test helper — seed events with explicit ids preserving sort order. */
  seed(events: SessionEvent[]): void {
    this.events = [...events].sort((a, b) => a.timestamp - b.timestamp);
    this.nextId = (events.reduce((m, e) => Math.max(m, e.id), 0) || 0) + 1;
  }

  async append(ev: Omit<SessionEvent, 'id'>): Promise<SessionEvent> {
    const stored: SessionEvent = { ...ev, id: this.nextId++ };
    this.events.push(stored);
    return stored;
  }

  async listByDateRange(
    fromMs: number,
    toMsExclusive: number
  ): Promise<SessionEvent[]> {
    return this.events
      .filter((e) => e.timestamp >= fromMs && e.timestamp < toMsExclusive)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async listByLine(lineId: string): Promise<SessionEvent[]> {
    return this.events
      .filter((e) => e.lineId === lineId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async listAll(): Promise<SessionEvent[]> {
    return [...this.events].sort((a, b) => a.timestamp - b.timestamp);
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
    this.events = [];
    this.nextId = 1;
  }
}
