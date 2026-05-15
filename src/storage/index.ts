/**
 * Storage DI — single entry point for the active OpeningRepository.
 *
 * Consumers import `getRepository()` and never reference concrete classes.
 * Swapping JSON for SQLite (Phase 2) means changing one line in this file.
 */

import { JsonOpeningRepository } from './JsonOpeningRepository';
import { IndexedDbSrsRepository } from './srs/IndexedDbSrsRepository';
import { InMemorySrsRepository } from './srs/InMemorySrsRepository';
import { IndexedDbEventsRepository } from './events/IndexedDbEventsRepository';
import { IndexedDbRepertoireRepository } from './repertoire/IndexedDbRepertoireRepository';
import { createEventsBus, type EventsBus } from './events/EventsBus';
import type { EventsRepository } from './events/EventsRepository';
import type { RepertoireRepository } from './repertoire/RepertoireRepository';
import type { OpeningRepository, SrsRepository } from './types';

let _repo: OpeningRepository | null = null;
let _srsRepo: SrsRepository | null = null;
let _eventsRepo: EventsRepository | null = null;
let _repertoireRepo: RepertoireRepository | null = null;
let _eventsBus: EventsBus | null = null;

export function getRepository(): OpeningRepository {
  if (_repo === null) {
    _repo = new JsonOpeningRepository();
  }
  return _repo;
}

/** Phase 1 — single SRS repository entry point. */
export function getSrsRepository(): SrsRepository {
  if (_srsRepo === null) {
    _srsRepo = new IndexedDbSrsRepository();
  }
  return _srsRepo;
}

/** Test-only: replace the singleton with a custom impl (e.g. an in-memory mock). */
export function _setRepositoryForTesting(repo: OpeningRepository | null): void {
  _repo = repo;
}

/** Test-only: replace the SRS repository singleton. */
export function _setSrsRepositoryForTesting(repo: SrsRepository | null): void {
  _srsRepo = repo;
}

// ---------------------------------------------------------------------------
// Phase 1.5 — events + repertoire repositories + bus
// ---------------------------------------------------------------------------

/** Process-wide event bus. Hooks subscribe; repos publish post-write. */
export function getEventsBus(): EventsBus {
  if (_eventsBus === null) _eventsBus = createEventsBus();
  return _eventsBus;
}

export function getEventsRepository(): EventsRepository {
  if (_eventsRepo === null) {
    _eventsRepo = wrapWithBusNotify(new IndexedDbEventsRepository(), getEventsBus());
  }
  return _eventsRepo;
}

export function getRepertoireRepository(): RepertoireRepository {
  if (_repertoireRepo === null) {
    _repertoireRepo = new IndexedDbRepertoireRepository();
  }
  return _repertoireRepo;
}

export function _setEventsRepositoryForTesting(
  repo: EventsRepository | null
): void {
  // Tests inject a bare repo; we still wrap with bus notify so hooks observe
  // appends through the same channel as production code. If the caller has
  // already wrapped (or doesn't want notifications), they pass null first to
  // unset.
  _eventsRepo = repo === null ? null : wrapWithBusNotify(repo, getEventsBus());
}

export function _setRepertoireRepositoryForTesting(
  repo: RepertoireRepository | null
): void {
  _repertoireRepo = repo;
}

export function _resetEventsBusForTesting(): void {
  _eventsBus = null;
}

/**
 * Decorator that publishes on the bus after every `append` and `clearAll`,
 * keeping the repo impl ignorant of pub/sub.
 */
function wrapWithBusNotify(
  inner: EventsRepository,
  bus: EventsBus
): EventsRepository {
  return {
    async append(ev) {
      const result = await inner.append(ev);
      bus.publish();
      return result;
    },
    listByDateRange: (from, to) => inner.listByDateRange(from, to),
    listByLine: (id) => inner.listByLine(id),
    listAll: () => inner.listAll(),
    aggregate: (q) => inner.aggregate(q),
    async clearAll() {
      await inner.clearAll();
      bus.publish();
    },
    resetDbCache: () => inner.resetDbCache(),
  };
}

export { InMemorySrsRepository };

export type {
  OpeningRepository,
  Opening,
  Line,
  KeySquare,
  Catalog,
  SearchQuery,
  Color,
  Side,
  Family,
  FamilyCategory,
  Variation,
  ForkAnnotation,
  Preset,
  SrsBox,
  SrsState,
  DrillResult,
  SrsRepository,
  // Phase 1b — Explain Mode
  Arrow,
  ArrowColor,
  HighlightSquare,
  HighlightIntent,
  ExplainBlock,
} from './types';
export { BOX_INTERVALS_DAYS } from './types';

// Phase 1.5 — events + repertoire
export type {
  EventType,
  SessionEvent,
  EventQuery,
  AggregateResult,
} from '../types/events';
export { emptyAggregate } from '../types/events';
export type {
  RepertoirePreset,
  RepertoirePick,
  EffectivePick,
} from '../types/repertoire';
export { DEFAULT_PICK, OFF_PRESET_ID } from '../types/repertoire';
export type { EventsRepository } from './events/EventsRepository';
export type { EventsBus } from './events/EventsBus';
export type { RepertoireRepository } from './repertoire/RepertoireRepository';
export { InMemoryEventsRepository } from './events/InMemoryEventsRepository';
export { InMemoryRepertoireRepository } from './repertoire/InMemoryRepertoireRepository';
