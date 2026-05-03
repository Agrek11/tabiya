/**
 * Storage DI — single entry point for the active OpeningRepository.
 *
 * Consumers import `getRepository()` and never reference concrete classes.
 * Swapping JSON for SQLite (Phase 2) means changing one line in this file.
 */

import { JsonOpeningRepository } from './JsonOpeningRepository';
import type { OpeningRepository } from './types';

let _repo: OpeningRepository | null = null;

export function getRepository(): OpeningRepository {
  if (_repo === null) {
    _repo = new JsonOpeningRepository();
  }
  return _repo;
}

/** Test-only: replace the singleton with a custom impl (e.g. an in-memory mock). */
export function _setRepositoryForTesting(repo: OpeningRepository | null): void {
  _repo = repo;
}

export type { OpeningRepository, Opening, Line, KeySquare, Catalog, SearchQuery, Color, Side } from './types';
