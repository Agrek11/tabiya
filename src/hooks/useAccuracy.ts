/**
 * useAccuracy — dashboard accuracy hook.
 * useLineAccuracy — per-line badge hook (reads from EventsContext fan-out).
 *
 * R4. Two `aggregate` calls: all-time + rolling 7d. Delta = (recent - allTime)
 * in percentage points, rounded to one decimal. Null on either side → null
 * delta (UI renders `—`).
 */

import { useEffect, useState } from 'react';
import { getEventsBus, getEventsRepository } from '../storage';
import {
  emptyAggregate,
  type AggregateResult,
} from '../types/events';
import { useLineAggregateFromContext } from '../state/EventsContext';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
/** Within ±this many pp, render `=` instead of a signed delta (design §4.3). */
export const DELTA_NEUTRAL_EPSILON_PP = 0.05;

export interface AccuracyResult {
  allTime: { accuracy: number | null; moves: number };
  rolling7d: { accuracy: number | null; moves: number };
  /** rolling - allTime in percentage points, 1-decimal rounded. Null if either
   *  side has null accuracy. */
  deltaPp: number | null;
}

const EMPTY: AccuracyResult = {
  allTime: { accuracy: null, moves: 0 },
  rolling7d: { accuracy: null, moves: 0 },
  deltaPp: null,
};

export function useAccuracy(): AccuracyResult {
  const [result, setResult] = useState<AccuracyResult>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    const recompute = async (): Promise<void> => {
      try {
        const repo = getEventsRepository();
        const now = Date.now();
        const all = await repo.aggregate({});
        // R4.7: 7-day window — events at exactly `cutoff` are INCLUDED
        // (inclusive `from`), events before are excluded.
        const from = now - SEVEN_DAYS_MS;
        const recent = await repo.aggregate({ from, to: now + 1 });
        if (cancelled) return;
        setResult(buildResult(all, recent));
      } catch (err) {
        console.error('useAccuracy recompute failed:', err);
      }
    };
    void recompute();
    const unsubscribe = getEventsBus().subscribe(() => void recompute());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return result;
}

function buildResult(all: AggregateResult, recent: AggregateResult): AccuracyResult {
  const deltaPp =
    all.accuracy !== null && recent.accuracy !== null
      ? Math.round((recent.accuracy * 100 - all.accuracy * 100) * 10) / 10
      : null;
  return {
    allTime: { accuracy: all.accuracy, moves: all.totalMoves },
    rolling7d: { accuracy: recent.accuracy, moves: recent.totalMoves },
    deltaPp,
  };
}

/** Per-line accuracy read from the shared EventsContext fan-out. Returns an
 *  empty aggregate when the line has no events yet so the caller can safely
 *  destructure without null-checks. */
export function useLineAccuracy(lineId: string): {
  accuracy: number | null;
  moves: number;
} {
  const agg: AggregateResult = useLineAggregateFromContext(lineId) ?? emptyAggregate();
  return { accuracy: agg.accuracy, moves: agg.totalMoves };
}
