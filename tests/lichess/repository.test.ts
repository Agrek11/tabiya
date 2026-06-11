/**
 * LichessRepository implementations vs the contract — Phase 3 R8 AC5.
 * IDB impl runs on fake-indexeddb; the in-memory double proves the interface
 * is implementation-agnostic (Article 5).
 */

import 'fake-indexeddb/auto';
import { IdbLichessRepository } from '../../src/lib/lichess/repository-idb';
import { InMemoryLichessRepository } from './in-memory-repository';
import { runLichessRepositoryContract } from './repository-contract';

async function freshIdbRepo(): Promise<IdbLichessRepository> {
  // any-ok: fake-indexeddb's reset hook is untyped (same pattern as
  // tests/indexeddb-srs-repository.test.ts).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const factory = indexedDB as any;
  if (typeof factory._databases?.clear === 'function') {
    factory._databases.clear();
  }
  return new IdbLichessRepository();
}

runLichessRepositoryContract('IndexedDB (fake-indexeddb)', freshIdbRepo);
runLichessRepositoryContract('InMemory test double', () => new InMemoryLichessRepository());
