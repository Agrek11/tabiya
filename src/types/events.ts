/**
 * Session event types — Phase 1.5 telemetry.
 *
 * Closed set of six event types covering the drill state-machine transitions
 * (R1.3). `SessionEvent` is the persisted shape; the repository's `append`
 * assigns `id` so consumers never construct it with `id: undefined`.
 *
 * Constitution Article 14: zero `any`. Constitution Article 6: `lineId` is
 * the canonical stable line slug.
 */

export type EventType =
  | 'line_start'
  | 'move_correct'
  | 'move_wrong'
  | 'hint_used'
  | 'line_complete'
  | 'line_abandoned';

export interface SessionEvent {
  id: number;
  timestamp: number; // ms since epoch, UTC
  eventType: EventType;
  lineId: string;
  plyIndex: number | null;
  durationMs: number | null;
}

export interface EventQuery {
  from?: number; // inclusive ms epoch
  to?: number; // exclusive ms epoch
  lineId?: string;
  eventTypes?: EventType[];
}

export interface AggregateResult {
  countByType: Record<EventType, number>;
  totalMoves: number; // move_correct + move_wrong
  correctMoves: number;
  accuracy: number | null; // null if totalMoves === 0
}

export function emptyAggregate(): AggregateResult {
  return {
    countByType: {
      line_start: 0,
      move_correct: 0,
      move_wrong: 0,
      hint_used: 0,
      line_complete: 0,
      line_abandoned: 0,
    },
    totalMoves: 0,
    correctMoves: 0,
    accuracy: null,
  };
}
