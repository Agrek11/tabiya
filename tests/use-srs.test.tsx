/**
 * Tests for useSRS hook. Uses InMemorySrsRepository via the test escape hatch.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { useSRS } from '../src/hooks/useSRS';
import {
  InMemorySrsRepository,
  _setSrsRepositoryForTesting,
} from '../src/storage';
import { BOX_INTERVALS_DAYS, type DrillResult } from '../src/storage/types';

const baseResult: DrillResult = {
  wrong_attempts: 0,
  hint_uses: 0,
  duration_ms: 1000,
  completed_at: '2026-05-09T12:00:00Z',
};

let repo: InMemorySrsRepository;

beforeEach(() => {
  repo = new InMemorySrsRepository();
  _setSrsRepositoryForTesting(repo);
});

afterEach(() => {
  cleanup();
  _setSrsRepositoryForTesting(null);
});

describe('useSRS', () => {
  it('loading=true initially, then states populate', async () => {
    await repo.recordDrillResult('a', baseResult);
    const { result } = renderHook(() => useSRS());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.states.get('a')?.line_id).toBe('a');
  });

  it('dueLineIds includes records past their interval', async () => {
    // Manually craft a state with an old timestamp so it is due.
    await repo.recordDrillResult('old', baseResult);
    const old = await repo.getState('old');
    if (old !== null) {
      // Backdate last_reviewed by 60 days so even Box 5 (30d) is due.
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      // Bypass repo API; reach in via reset+manual put surrogate.
      await repo.resetState('old');
      // Use record + then mutate via a fresh write with adjusted state.
      await repo.recordDrillResult('old', baseResult);
      const cur = await repo.getState('old');
      if (cur !== null) {
        cur.last_reviewed = sixtyDaysAgo.toISOString();
        // Re-insert by hijacking the underlying map: easiest is reset + put
        // through a new write with same line_id; but we want last_reviewed
        // set explicitly. Cheat by directly mutating (in-memory).
        (repo as unknown as { states: Map<string, typeof cur> }).states.set('old', cur);
      }
    }

    const { result } = renderHook(() => useSRS());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.dueLineIds).toContain('old');
  });

  it('refresh() re-reads from repository', async () => {
    const { result } = renderHook(() => useSRS());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.states.size).toBe(0);

    await repo.recordDrillResult('a', baseResult);
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.states.size).toBe(1);
    expect(result.current.states.get('a')?.box).toBe(2);
  });

  it('not-due record excluded from dueLineIds', async () => {
    // Just-now write → Box 2 → due-after = now + 3 days → NOT due now.
    await repo.recordDrillResult('fresh', baseResult);
    const { result } = renderHook(() => useSRS());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.dueLineIds).not.toContain('fresh');
    // Sanity: BOX_INTERVALS_DAYS is being honored (3 day gap for Box 2)
    expect(BOX_INTERVALS_DAYS[2]).toBe(3);
  });
});
