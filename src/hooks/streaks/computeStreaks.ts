/**
 * Pure streak computation — isolated from React for trivial testability.
 *
 * Two streaks:
 *   - drillDayStreak: consecutive local-calendar days, walking back from
 *     `now`, that contain at least one `line_start` event.
 *   - lineMasteryStreak: consecutive terminal line sessions (newest-first)
 *     where the session was a `line_complete` AND had zero `move_wrong`
 *     events. Breaks on either a `line_abandoned` terminal or any session
 *     with `move_wrong > 0`.
 *
 * R2.1 + R2.2. Local timezone at query time per Open Question #2 disposition.
 *
 * Edge case: a `line_start` without a terminal (browser closed mid-drill, no
 * `beforeunload` flush) is dropped from the mastery walk — neither breaks nor
 * extends the streak.
 */

import type { SessionEvent } from '../../types/events';

export interface StreaksResult {
  drillDayStreak: number;
  lineMasteryStreak: number;
  /** ms epoch of newest event seen, or 0 when input is empty. */
  lastUpdated: number;
}

export const EMPTY_STREAKS: StreaksResult = {
  drillDayStreak: 0,
  lineMasteryStreak: 0,
  lastUpdated: 0,
};

export function localDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

interface LineSession {
  lineId: string;
  startTimestamp: number;
  wrongMoves: number;
  terminal: SessionEvent | null;
}

/**
 * Walks events in timestamp order. Opens a session on each `line_start`,
 * accumulates `move_wrong` events into the open session, and closes the
 * session on `line_complete` / `line_abandoned`. Returns sessions in start
 * order; consumers sort by terminal timestamp as needed.
 */
export function groupIntoLineSessions(events: SessionEvent[]): LineSession[] {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const sessions: LineSession[] = [];
  let open: LineSession | null = null;
  for (const e of sorted) {
    if (e.eventType === 'line_start') {
      // If a prior session was still open (no terminal), drop it — it neither
      // breaks nor extends the mastery walk (design §2.2).
      open = {
        lineId: e.lineId,
        startTimestamp: e.timestamp,
        wrongMoves: 0,
        terminal: null,
      };
      sessions.push(open);
      continue;
    }
    if (open === null) continue;
    if (e.lineId !== open.lineId) continue;
    if (e.eventType === 'move_wrong') {
      open.wrongMoves += 1;
    } else if (
      e.eventType === 'line_complete' ||
      e.eventType === 'line_abandoned'
    ) {
      open.terminal = e;
      open = null;
    }
  }
  return sessions;
}

export function computeStreaks(
  events: SessionEvent[],
  now: Date
): StreaksResult {
  if (events.length === 0) return { ...EMPTY_STREAKS };

  // ---- Drill-day streak ----
  const daysWithStart = new Set<string>();
  for (const e of events) {
    if (e.eventType === 'line_start') {
      daysWithStart.add(localDayKey(e.timestamp));
    }
  }
  let drillDayStreak = 0;
  // Walk back from today. Today must contain a line_start for the streak to
  // be ≥1; otherwise streak is 0 even if yesterday qualified.
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  while (daysWithStart.has(localDayKey(cursor.getTime()))) {
    drillDayStreak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // ---- Line-mastery streak ----
  const sessions = groupIntoLineSessions(events);
  const terminals = sessions
    .filter((s): s is LineSession & { terminal: SessionEvent } => s.terminal !== null)
    .sort((a, b) => b.terminal.timestamp - a.terminal.timestamp);
  let lineMasteryStreak = 0;
  for (const s of terminals) {
    if (s.terminal.eventType === 'line_abandoned') break;
    if (s.wrongMoves > 0) break;
    lineMasteryStreak++;
  }

  const lastUpdated = events.reduce(
    (max, e) => (e.timestamp > max ? e.timestamp : max),
    0
  );

  return { drillDayStreak, lineMasteryStreak, lastUpdated };
}
