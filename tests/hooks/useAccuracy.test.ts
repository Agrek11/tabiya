/**
 * useAccuracy — four scenarios per R7.3.
 *
 * The hook is a thin wrapper over `EventsRepository.aggregate({})` and
 * `aggregate({ from, to })`. We swap in `InMemoryEventsRepository` via the
 * DI seam so we own the timestamps and assert against the public hook
 * surface (`allTime`, `rolling7d`, `deltaPp`).
 *
 * Window boundary (R4.7 / design §4.2):
 *   - inclusive `from`  → event AT `now - 7d`        is INCLUDED
 *   - exclusive `to`    → event AT `cutoff - 1ms`    is EXCLUDED
 *
 * The hook passes `from = now - 7d` and `to = now + 1`, so any event at
 * `now - 7d` is included (boundary) and any event before is excluded.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useAccuracy } from '../../src/hooks/useAccuracy';
import {
  InMemoryEventsRepository,
  _resetEventsBusForTesting,
  _setEventsRepositoryForTesting,
} from '../../src/storage';
import type { SessionEvent } from '../../src/types/events';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function move(
  ts: number,
  eventType: 'move_correct' | 'move_wrong',
  id: number,
  lineId = 'a'
): SessionEvent {
  return { id, timestamp: ts, eventType, lineId, plyIndex: 0, durationMs: null };
}

describe('useAccuracy', () => {
  let now: number;
  let repo: InMemoryEventsRepository;

  beforeEach(() => {
    now = new Date('2026-05-15T18:00:00Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    _resetEventsBusForTesting();
    repo = new InMemoryEventsRepository();
    _setEventsRepositoryForTesting(repo);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _setEventsRepositoryForTesting(null);
    _resetEventsBusForTesting();
  });

  it('zero denominator → null accuracy + null delta', async () => {
    const { result } = renderHook(() => useAccuracy());
    await waitFor(() => {
      expect(result.current.allTime.moves).toBe(0);
    });
    expect(result.current.allTime.accuracy).toBeNull();
    expect(result.current.rolling7d.accuracy).toBeNull();
    expect(result.current.deltaPp).toBeNull();
  });

  it('all-correct → accuracy 1.0 on both windows, delta 0', async () => {
    repo.seed([
      move(now - 1000, 'move_correct', 1),
      move(now - 2000, 'move_correct', 2),
      move(now - 3000, 'move_correct', 3),
    ]);

    const { result } = renderHook(() => useAccuracy());
    await waitFor(() => {
      expect(result.current.allTime.moves).toBe(3);
    });
    expect(result.current.allTime.accuracy).toBe(1);
    expect(result.current.rolling7d.accuracy).toBe(1);
    expect(result.current.rolling7d.moves).toBe(3);
    expect(result.current.deltaPp).toBe(0);
  });

  it('mixed correct/wrong → expected ratio + 1-decimal delta', async () => {
    // All-time: 3 correct + 1 wrong = 0.75
    // Rolling 7d: same set (all within window) = 0.75; delta = 0
    repo.seed([
      move(now - 100, 'move_correct', 1),
      move(now - 200, 'move_correct', 2),
      move(now - 300, 'move_correct', 3),
      move(now - 400, 'move_wrong', 4),
    ]);

    const { result } = renderHook(() => useAccuracy());
    await waitFor(() => {
      expect(result.current.allTime.moves).toBe(4);
    });
    expect(result.current.allTime.accuracy).toBe(0.75);
    expect(result.current.rolling7d.accuracy).toBe(0.75);
    expect(result.current.deltaPp).toBe(0);
  });

  it('mixed with different windows → recomputes delta in pp', async () => {
    // Old events (outside 7-day window): 1 correct, 1 wrong → all-time portion
    // Recent events (inside window):     3 correct           → recent portion
    // All-time: 4 correct + 1 wrong = 0.8 (80%)
    // Rolling : 3 correct + 0 wrong = 1.0 (100%)
    // Delta   : (1.0 - 0.8) * 100 = +20.0pp
    repo.seed([
      move(now - SEVEN_DAYS_MS - 100, 'move_correct', 1),
      move(now - SEVEN_DAYS_MS - 200, 'move_wrong', 2),
      move(now - 100, 'move_correct', 3),
      move(now - 200, 'move_correct', 4),
      move(now - 300, 'move_correct', 5),
    ]);

    const { result } = renderHook(() => useAccuracy());
    await waitFor(() => {
      expect(result.current.allTime.moves).toBe(5);
    });
    expect(result.current.allTime.accuracy).toBeCloseTo(0.8, 5);
    expect(result.current.rolling7d.accuracy).toBe(1);
    expect(result.current.rolling7d.moves).toBe(3);
    expect(result.current.deltaPp).toBe(20);
  });

  it('7-day window boundary: event AT cutoff included; event BEFORE excluded', async () => {
    const cutoff = now - SEVEN_DAYS_MS;
    // Event exactly at the inclusive `from` boundary → IN
    // Event 1ms before the boundary                  → OUT
    repo.seed([
      move(cutoff, 'move_correct', 1),
      move(cutoff - 1, 'move_wrong', 2),
    ]);

    const { result } = renderHook(() => useAccuracy());
    await waitFor(() => {
      expect(result.current.allTime.moves).toBe(2);
    });
    // All-time captures both; recent window captures only the boundary event.
    expect(result.current.allTime.accuracy).toBe(0.5);
    expect(result.current.rolling7d.moves).toBe(1);
    expect(result.current.rolling7d.accuracy).toBe(1);
    // Delta in pp: (1.0 - 0.5) * 100 = +50.0
    expect(result.current.deltaPp).toBe(50);
  });

  it('recomputes on bus publish (append triggers refresh)', async () => {
    const { result } = renderHook(() => useAccuracy());
    await waitFor(() => {
      expect(result.current.allTime.moves).toBe(0);
    });

    await act(async () => {
      // Append through the DI-wrapped repo so bus fires.
      const { getEventsRepository } = await import('../../src/storage');
      await getEventsRepository().append({
        timestamp: now - 100,
        eventType: 'move_correct',
        lineId: 'a',
        plyIndex: 0,
        durationMs: null,
      });
      // Bus uses rAF; with real timers it resolves naturally on next frame.
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => {
      expect(result.current.allTime.moves).toBe(1);
    });
    expect(result.current.allTime.accuracy).toBe(1);
  });
});
