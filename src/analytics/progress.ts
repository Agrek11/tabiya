import type { SessionEvent } from '../types/events';

export type LineContext = {
  lineId: string;
  openingId: string;
  openingName: string;
};

export type DrillSession = {
  lineId: string;
  startedAt: number;
  endedAt: number;
  completed: boolean;
  correctMoves: number;
  wrongMoves: number;
  studyMs: number;
};

export type DailyRetention = {
  day: string;
  retention: number | null;
  sessions: number;
  studyMs: number;
};

export type OpeningPerformance = {
  openingId: string;
  openingName: string;
  sessions: number;
  completed: number;
  accuracy: number | null;
  studyMs: number;
};

export type ProgressSummary = {
  retention: number | null;
  terminalSessions: number;
  cleanSessions: number;
  totalStudyMs: number;
  trend: DailyRetention[];
  openingPerformance: OpeningPerformance[];
};

type OpenSession = {
  lineId: string;
  startedAt: number;
  correctMoves: number;
  wrongMoves: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function localDay(timestamp: number): string {
  const date = new Date(timestamp);
  return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
}

function atStartOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function safeDuration(event: SessionEvent, session: OpenSession): number {
  const duration = event.durationMs ?? event.timestamp - session.startedAt;
  return Number.isFinite(duration) ? Math.max(0, duration) : 0;
}

/** Turns append-only drill events into closed sessions. Open sessions are not
 * counted: a tab can be closed before its cleanup event reaches IndexedDB. */
export function sessionsFromEvents(events: SessionEvent[]): DrillSession[] {
  const openByLine = new Map<string, OpenSession>();
  const sessions: DrillSession[] = [];
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp || a.id - b.id);

  for (const event of sorted) {
    if (event.eventType === 'line_start') {
      openByLine.set(event.lineId, {
        lineId: event.lineId,
        startedAt: event.timestamp,
        correctMoves: 0,
        wrongMoves: 0,
      });
      continue;
    }
    const open = openByLine.get(event.lineId);
    if (!open) continue;
    if (event.eventType === 'move_correct') {
      open.correctMoves += 1;
      continue;
    }
    if (event.eventType === 'move_wrong') {
      open.wrongMoves += 1;
      continue;
    }
    if (event.eventType === 'line_complete' || event.eventType === 'line_abandoned') {
      sessions.push({
        lineId: open.lineId,
        startedAt: open.startedAt,
        endedAt: event.timestamp,
        completed: event.eventType === 'line_complete',
        correctMoves: open.correctMoves,
        wrongMoves: open.wrongMoves,
        studyMs: safeDuration(event, open),
      });
      openByLine.delete(event.lineId);
    }
  }
  return sessions;
}

function percentage(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

/** Retention means completing a line without a wrong move, not raw move accuracy. */
function isClean(session: DrillSession): boolean {
  return session.completed && session.wrongMoves === 0;
}

export function formatStudyTime(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return minutes + 'm';
  const hours = Math.floor(minutes / 60);
  return hours + 'h ' + (minutes % 60) + 'm';
}

export function buildProgressSummary(
  events: SessionEvent[],
  contexts: LineContext[],
  now = Date.now(),
): ProgressSummary {
  const sessions = sessionsFromEvents(events);
  const cleanSessions = sessions.filter(isClean).length;
  const contextByLine = new Map(contexts.map((context) => [context.lineId, context]));
  const byOpening = new Map<
    string,
    {
      openingId: string;
      openingName: string;
      sessions: number;
      completed: number;
      correctMoves: number;
      moves: number;
      studyMs: number;
    }
  >();

  for (const session of sessions) {
    const context = contextByLine.get(session.lineId);
    const openingId = context?.openingId ?? 'unmapped';
    const current = byOpening.get(openingId) ?? {
      openingId,
      openingName: context?.openingName ?? 'Other drills',
      sessions: 0,
      completed: 0,
      correctMoves: 0,
      moves: 0,
      studyMs: 0,
    };
    current.sessions += 1;
    current.completed += session.completed ? 1 : 0;
    current.correctMoves += session.correctMoves;
    current.moves += session.correctMoves + session.wrongMoves;
    current.studyMs += session.studyMs;
    byOpening.set(openingId, current);
  }

  const start = atStartOfLocalDay(now) - DAY_MS * 6;
  const byDay = new Map<string, DrillSession[]>();
  for (const session of sessions) {
    if (session.endedAt < start) continue;
    const key = localDay(session.endedAt);
    byDay.set(key, [...(byDay.get(key) ?? []), session]);
  }
  const trend: DailyRetention[] = Array.from({ length: 7 }, (_, index) => {
    const timestamp = start + DAY_MS * index;
    const daySessions = byDay.get(localDay(timestamp)) ?? [];
    return {
      day: new Date(timestamp).toLocaleDateString(undefined, { weekday: 'short' }),
      retention: percentage(daySessions.filter(isClean).length, daySessions.length),
      sessions: daySessions.length,
      studyMs: daySessions.reduce((total, session) => total + session.studyMs, 0),
    };
  });

  return {
    retention: percentage(cleanSessions, sessions.length),
    terminalSessions: sessions.length,
    cleanSessions,
    totalStudyMs: sessions.reduce((total, session) => total + session.studyMs, 0),
    trend,
    openingPerformance: [...byOpening.values()]
      .map((opening) => ({
        openingId: opening.openingId,
        openingName: opening.openingName,
        sessions: opening.sessions,
        completed: opening.completed,
        accuracy: percentage(opening.correctMoves, opening.moves),
        studyMs: opening.studyMs,
      }))
      .sort((a, b) => b.sessions - a.sessions || a.openingName.localeCompare(b.openingName)),
  };
}

