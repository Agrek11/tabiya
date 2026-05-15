/**
 * EventsRepository — Article 5 seam for the session events log.
 *
 * Append-only. Reads come in three flavors: full-list (streak walk), date-range
 * (rolling accuracy windows), and per-line (per-line accuracy badge). The
 * `aggregate` helper routes to the cheapest underlying call based on the query
 * shape so consumers never have to think about which index to hit.
 *
 * Constitution Article 11: all storage is local IDB; no network egress.
 */

import type {
  AggregateResult,
  EventQuery,
  SessionEvent,
} from '../../types/events';

export interface EventsRepository {
  append(event: Omit<SessionEvent, 'id'>): Promise<SessionEvent>;
  listByDateRange(fromMs: number, toMsExclusive: number): Promise<SessionEvent[]>;
  listByLine(lineId: string): Promise<SessionEvent[]>;
  listAll(): Promise<SessionEvent[]>;
  aggregate(query: EventQuery): Promise<AggregateResult>;
  clearAll(): Promise<void>;
  /** Test escape hatch — drop cached DB handle so a re-mocked global indexedDB
   *  takes effect on the next call. Mirrors IndexedDbSrsRepository. */
  resetDbCache(): void;
}
