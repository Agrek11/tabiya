/**
 * Storage DI — single entry point for the active OpeningRepository.
 *
 * Consumers import `getRepository()` and never reference concrete classes.
 * Swapping JSON for SQLite (Phase 2) means changing one line in this file.
 */

import { JsonOpeningRepository } from './JsonOpeningRepository';
import { IndexedDbSrsRepository } from './srs/IndexedDbSrsRepository';
import { InMemorySrsRepository } from './srs/InMemorySrsRepository';
import type { OpeningRepository, SrsRepository } from './types';

let _repo: OpeningRepository | null = null;
let _srsRepo: SrsRepository | null = null;

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
