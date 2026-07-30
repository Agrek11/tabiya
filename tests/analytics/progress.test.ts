import { describe, expect, it } from 'vitest';
import { buildProgressSummary, formatStudyTime, sessionsFromEvents } from '../../src/analytics/progress';
import type { SessionEvent } from '../../src/types/events';

function event(
  id: number,
  timestamp: number,
  eventType: SessionEvent['eventType'],
  lineId: string,
  durationMs: number | null = null,
): SessionEvent {
  return { id, timestamp, eventType, lineId, plyIndex: null, durationMs };
}

describe('progress analytics', () => {
  it('derives clean recall, study time, trend, and opening performance from closed sessions', () => {
    const now = new Date(2026, 6, 29, 12).getTime();
    const events = [
      event(1, now - 2 * 86_400_000, 'line_start', 'line-a'),
      event(2, now - 2 * 86_400_000 + 10_000, 'move_correct', 'line-a', 10_000),
      event(3, now - 2 * 86_400_000 + 120_000, 'line_complete', 'line-a', 120_000),
      event(4, now - 86_400_000, 'line_start', 'line-b'),
      event(5, now - 86_400_000 + 10_000, 'move_wrong', 'line-b', 10_000),
      event(6, now - 86_400_000 + 60_000, 'line_abandoned', 'line-b', 60_000),
    ];
    const summary = buildProgressSummary(events, [
      { lineId: 'line-a', openingId: 'a', openingName: 'Alpha' },
      { lineId: 'line-b', openingId: 'b', openingName: 'Beta' },
    ], now);

    expect(sessionsFromEvents(events)).toHaveLength(2);
    expect(summary.retention).toBe(50);
    expect(summary.cleanSessions).toBe(1);
    expect(summary.totalStudyMs).toBe(180_000);
    expect(formatStudyTime(summary.totalStudyMs)).toBe('3m');
    expect(summary.trend.reduce((total, day) => total + day.sessions, 0)).toBe(2);
    expect(summary.openingPerformance.find((opening) => opening.openingId === 'a')).toMatchObject({
      sessions: 1,
      completed: 1,
      accuracy: 100,
    });
    expect(summary.openingPerformance.find((opening) => opening.openingId === 'b')).toMatchObject({
      sessions: 1,
      completed: 0,
      accuracy: 0,
    });
  });

  it('does not count an unclosed session as study time or retention', () => {
    const events = [event(1, 1_000, 'line_start', 'line-a')];
    const summary = buildProgressSummary(events, [], 2_000);
    expect(summary.terminalSessions).toBe(0);
    expect(summary.retention).toBeNull();
    expect(summary.totalStudyMs).toBe(0);
  });
});

