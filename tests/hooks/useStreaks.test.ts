/**
 * Streak computation tests — six scenarios per R7.2.
 *
 * Tests target the pure `computeStreaks` function so we sidestep React +
 * event-bus plumbing. The hook itself is a thin pipe over this function
 * + `getEventsRepository().listAll()`.
 */

import { describe, expect, it } from 'vitest';
import {
  computeStreaks,
  EMPTY_STREAKS,
} from '../../src/hooks/streaks/computeStreaks';
import type { SessionEvent } from '../../src/types/events';

const ONE_DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-05-15T18:00:00');
const NOW_TS = NOW.getTime();

function ev(
  ts: number,
  eventType: SessionEvent['eventType'],
  lineId: string,
  id = 0
): SessionEvent {
  return {
    id,
    timestamp: ts,
    eventType,
    lineId,
    plyIndex: eventType.startsWith('move_') ? 0 : null,
    durationMs: null,
  };
}

describe('computeStreaks', () => {
  it('zero events → both streaks zero', () => {
    const out = computeStreaks([], NOW);
    expect(out).toEqual(EMPTY_STREAKS);
  });

  it('single-day streak (one drill today)', () => {
    const events = [
      ev(NOW_TS - 60_000, 'line_start', 'a'),
      ev(NOW_TS - 50_000, 'move_correct', 'a'),
      ev(NOW_TS - 40_000, 'line_complete', 'a'),
    ];
    const out = computeStreaks(events, NOW);
    expect(out.drillDayStreak).toBe(1);
    expect(out.lineMasteryStreak).toBe(1);
  });

  it('multi-day continuous streak', () => {
    const events = [
      ev(NOW_TS - 3 * ONE_DAY, 'line_start', 'a'),
      ev(NOW_TS - 3 * ONE_DAY + 1000, 'line_complete', 'a'),
      ev(NOW_TS - 2 * ONE_DAY, 'line_start', 'a'),
      ev(NOW_TS - 2 * ONE_DAY + 1000, 'line_complete', 'a'),
      ev(NOW_TS - 1 * ONE_DAY, 'line_start', 'a'),
      ev(NOW_TS - 1 * ONE_DAY + 1000, 'line_complete', 'a'),
      ev(NOW_TS, 'line_start', 'a'),
      ev(NOW_TS + 1000, 'line_complete', 'a'),
    ];
    const out = computeStreaks(events, NOW);
    expect(out.drillDayStreak).toBe(4);
    expect(out.lineMasteryStreak).toBe(4);
  });

  it('broken streak by gap day', () => {
    const events = [
      ev(NOW_TS - 3 * ONE_DAY, 'line_start', 'a'),
      ev(NOW_TS - 3 * ONE_DAY + 1000, 'line_complete', 'a'),
      // Gap on day-2
      ev(NOW_TS - 1 * ONE_DAY, 'line_start', 'a'),
      ev(NOW_TS - 1 * ONE_DAY + 1000, 'line_complete', 'a'),
      ev(NOW_TS, 'line_start', 'a'),
      ev(NOW_TS + 1000, 'line_complete', 'a'),
    ];
    const out = computeStreaks(events, NOW);
    expect(out.drillDayStreak).toBe(2); // today + yesterday only
  });

  it('mastery streak broken by wrong move', () => {
    const events = [
      ev(NOW_TS - 2000, 'line_start', 'a'),
      ev(NOW_TS - 1900, 'move_correct', 'a'),
      ev(NOW_TS - 1800, 'line_complete', 'a'),

      ev(NOW_TS - 1000, 'line_start', 'a'),
      ev(NOW_TS - 900, 'move_wrong', 'a'),
      ev(NOW_TS - 850, 'move_correct', 'a'),
      ev(NOW_TS - 800, 'line_complete', 'a'),
    ];
    const out = computeStreaks(events, NOW);
    expect(out.lineMasteryStreak).toBe(0); // newest terminal has a wrong move
  });

  it('mastery streak broken by abandonment', () => {
    const events = [
      ev(NOW_TS - 2000, 'line_start', 'a'),
      ev(NOW_TS - 1900, 'move_correct', 'a'),
      ev(NOW_TS - 1800, 'line_complete', 'a'),

      ev(NOW_TS - 1000, 'line_start', 'a'),
      ev(NOW_TS - 800, 'line_abandoned', 'a'),
    ];
    const out = computeStreaks(events, NOW);
    expect(out.lineMasteryStreak).toBe(0);
  });
});
