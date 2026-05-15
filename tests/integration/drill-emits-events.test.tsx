/**
 * Integration — drill emission contract (R7.5).
 *
 * Replays the exact state-transition sequence DrillPage produces against the
 * `useEventEmitter` hook (the same hook DrillPage uses, in the same way) and
 * asserts the persisted event log matches the spec:
 *
 *   Clean 6-ply drill →
 *     [line_start, move_correct×6, line_complete]
 *     with plyIndex 0..5 on the move events and 5 on line_complete.
 *
 *   One wrong move at ply 3 then retry →
 *     [line_start, move_correct×3, move_wrong, move_correct×3, line_complete]
 *     mastery streak resets to 0 (validated via `computeStreaks`).
 *
 * Why drive the hook directly instead of mounting DrillPage:
 *   - DrillPage's full drive (board interaction + move validation) is exercised
 *     by `drill-page.test.tsx` already.
 *   - The R7.5 contract is "the right events at the right plyIndex" — that lives
 *     in the hook + the transition observer effect, not in board mechanics.
 *   - Renderless mode keeps the test deterministic and free of fake-timer +
 *     jsdom chessboard layout flakes.
 *
 * The harness here mirrors DrillPage's emit calls 1:1 (see DrillPage.tsx
 * "Phase 1.5 — Session-event telemetry" block).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useEventEmitter } from '../../src/hooks/useEventEmitter';
import {
  InMemoryEventsRepository,
  _resetEventsBusForTesting,
  _setEventsRepositoryForTesting,
  getEventsRepository,
} from '../../src/storage';
import { computeStreaks } from '../../src/hooks/streaks/computeStreaks';
import type { SessionEvent } from '../../src/types/events';

const LINE_ID = 'ruy-lopez-main';
const PLY_COUNT = 6;

async function flushMicrotasks(): Promise<void> {
  // queueMicrotask drains in a microtask flush; await two ticks to be safe.
  await Promise.resolve();
  await Promise.resolve();
}

async function snapshotEvents(): Promise<SessionEvent[]> {
  return getEventsRepository().listAll();
}

describe('drill → event sequence integration (R7.5)', () => {
  let repo: InMemoryEventsRepository;

  beforeEach(() => {
    _resetEventsBusForTesting();
    repo = new InMemoryEventsRepository();
    _setEventsRepositoryForTesting(repo);
  });

  afterEach(() => {
    _setEventsRepositoryForTesting(null);
    _resetEventsBusForTesting();
  });

  it('clean 6-ply drill emits [line_start, move_correct×6, line_complete]', async () => {
    const { result, unmount } = renderHook(() => useEventEmitter(LINE_ID));

    // Hook activation → line_start (emitted in useEffect on mount).
    await flushMicrotasks();

    // Drive 6 correct moves with ascending plyIndex 0..5.
    await act(async () => {
      for (let ply = 0; ply < PLY_COUNT; ply++) {
        result.current.emit('move_correct', ply);
      }
    });
    await flushMicrotasks();

    // Completion: DrillPage emits line_complete with plyIndex = lastPly.
    await act(async () => {
      result.current.emit('line_complete', PLY_COUNT - 1);
    });
    await flushMicrotasks();

    const events = await snapshotEvents();
    const sequence = events.map((e) => e.eventType);
    expect(sequence).toEqual([
      'line_start',
      'move_correct',
      'move_correct',
      'move_correct',
      'move_correct',
      'move_correct',
      'move_correct',
      'line_complete',
    ]);
    expect(events.every((e) => e.lineId === LINE_ID)).toBe(true);

    // plyIndex assertions: move events 0..5, line_start null, line_complete 5.
    const movePlys = events
      .filter((e) => e.eventType === 'move_correct')
      .map((e) => e.plyIndex);
    expect(movePlys).toEqual([0, 1, 2, 3, 4, 5]);
    expect(events.find((e) => e.eventType === 'line_start')!.plyIndex).toBeNull();
    expect(events.find((e) => e.eventType === 'line_complete')!.plyIndex).toBe(
      PLY_COUNT - 1
    );

    // Unmount AFTER line_complete → no spurious line_abandoned (hook guards
    // cleanup on terminal state).
    unmount();
    await flushMicrotasks();
    const afterUnmount = await snapshotEvents();
    expect(afterUnmount.some((e) => e.eventType === 'line_abandoned')).toBe(false);
  });

  it('one wrong move at ply 3 then retry: full sequence + mastery streak broken', async () => {
    const { result } = renderHook(() => useEventEmitter(LINE_ID));
    await flushMicrotasks();

    await act(async () => {
      // Correct plys 0, 1, 2
      result.current.emit('move_correct', 0);
      result.current.emit('move_correct', 1);
      result.current.emit('move_correct', 2);
      // Wrong at ply 3
      result.current.emit('move_wrong', 3);
      // Correct retry at ply 3, then 4, 5
      result.current.emit('move_correct', 3);
      result.current.emit('move_correct', 4);
      result.current.emit('move_correct', 5);
      result.current.emit('line_complete', PLY_COUNT - 1);
    });
    await flushMicrotasks();

    const events = await snapshotEvents();
    const sequence = events.map((e) => e.eventType);
    expect(sequence).toEqual([
      'line_start',
      'move_correct',
      'move_correct',
      'move_correct',
      'move_wrong',
      'move_correct',
      'move_correct',
      'move_correct',
      'line_complete',
    ]);

    // The single wrong-at-ply-3 event is preserved (R1.7 — no collapsing).
    const wrongEvents = events.filter((e) => e.eventType === 'move_wrong');
    expect(wrongEvents).toHaveLength(1);
    expect(wrongEvents[0]!.plyIndex).toBe(3);

    // Mastery streak broken because the newest terminal session has wrong > 0.
    const streaks = computeStreaks(events, new Date());
    expect(streaks.lineMasteryStreak).toBe(0);
    // Daily streak still 1 (drilled today).
    expect(streaks.drillDayStreak).toBe(1);
  });

  it('unmount before completion emits line_abandoned', async () => {
    const { result, unmount } = renderHook(() => useEventEmitter(LINE_ID));
    await flushMicrotasks();

    await act(async () => {
      result.current.emit('move_correct', 0);
      result.current.emit('move_correct', 1);
    });
    await flushMicrotasks();

    unmount();
    await flushMicrotasks();

    const events = await snapshotEvents();
    const types = events.map((e) => e.eventType);
    expect(types).toEqual([
      'line_start',
      'move_correct',
      'move_correct',
      'line_abandoned',
    ]);
    // line_abandoned carries lineId + the last recorded plyIndex.
    const ab = events.find((e) => e.eventType === 'line_abandoned')!;
    expect(ab.lineId).toBe(LINE_ID);
    expect(ab.plyIndex).toBe(1);
  });

  it('hint_used event interleaves without disturbing move sequence', async () => {
    const { result } = renderHook(() => useEventEmitter(LINE_ID));
    await flushMicrotasks();

    await act(async () => {
      result.current.emit('move_correct', 0);
      result.current.emit('hint_used', 1);
      result.current.emit('move_correct', 1);
      result.current.emit('line_complete', 1);
    });
    await flushMicrotasks();

    const events = await snapshotEvents();
    expect(events.map((e) => e.eventType)).toEqual([
      'line_start',
      'move_correct',
      'hint_used',
      'move_correct',
      'line_complete',
    ]);
  });
});

// Sanity import to ensure waitFor is wired even when unused (helps surface
// missing testing-library install rather than hide it behind the renderHook
// import). The lint rule allows unused named imports flagged as type-only —
// but here we keep the symbol live by referencing it.
void waitFor;
