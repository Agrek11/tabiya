/**
 * Interface-contract tests for InMemorySrsRepository.
 *
 * Same contract is reused by IndexedDbSrsRepository tests.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { InMemorySrsRepository } from '../src/storage/srs/InMemorySrsRepository';
import type { DrillResult, SrsRepository } from '../src/storage/types';

const baseResult: DrillResult = {
  wrong_attempts: 0,
  hint_uses: 0,
  duration_ms: 1000,
  completed_at: '2026-05-09T12:00:00Z',
};

describe('InMemorySrsRepository', () => {
  let repo: SrsRepository;
  beforeEach(() => {
    repo = new InMemorySrsRepository();
  });

  it('empty initial state', async () => {
    expect(await repo.listAllStates()).toEqual([]);
    expect(await repo.getState('nope')).toBeNull();
  });

  it('recordDrillResult creates state on first call', async () => {
    const s = await repo.recordDrillResult('ruy-lopez-main', baseResult);
    expect(s.line_id).toBe('ruy-lopez-main');
    expect(s.box).toBe(2); // first flawless drill → Box 2
    expect(s.attempts).toBe(1);
  });

  it('recordDrillResult updates existing state on second call', async () => {
    await repo.recordDrillResult('x', baseResult); // Box 2
    const s = await repo.recordDrillResult('x', baseResult); // promote to Box 3
    expect(s.box).toBe(3);
    expect(s.attempts).toBe(2);
  });

  it('listAllStates reflects all writes', async () => {
    await repo.recordDrillResult('a', baseResult);
    await repo.recordDrillResult('b', baseResult);
    const all = await repo.listAllStates();
    expect(all.map((s) => s.line_id).sort()).toEqual(['a', 'b']);
  });

  it('getState returns the matching state', async () => {
    await repo.recordDrillResult('a', baseResult);
    const s = await repo.getState('a');
    expect(s?.line_id).toBe('a');
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

  it('demote-one applied through the repo path', async () => {
    await repo.recordDrillResult('x', baseResult); // Box 2
    await repo.recordDrillResult('x', baseResult); // Box 3
    const s = await repo.recordDrillResult('x', { ...baseResult, wrong_attempts: 5 });
    expect(s.box).toBe(2); // demote-one from 3
  });
});
