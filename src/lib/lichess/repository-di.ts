/**
 * DI accessor for LichessRepository (Article 5) — consumers never import the
 * IDB impl. `__setLichessRepositoryForTest` is the only test escape.
 */

import type { LichessRepository } from './repository';
import { IdbLichessRepository } from './repository-idb';

let _instance: LichessRepository | null = null;

export function getLichessRepository(): LichessRepository {
  if (!_instance) _instance = new IdbLichessRepository();
  return _instance;
}

export function __setLichessRepositoryForTest(impl: LichessRepository | null): void {
  _instance = impl;
}
