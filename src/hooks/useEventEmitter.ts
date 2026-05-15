/**
 * useEventEmitter — owns the line lifecycle for telemetry emission.
 *
 * The drill page calls `emit(eventType, plyIndex?)` on validator-confirmed
 * transitions. The hook itself owns:
 *   - `line_start` emission on activation (effect keyed on `lineId`)
 *   - `line_abandoned` emission on cleanup IFF the latest emitted state was
 *     not `line_complete`
 *   - timing refs (`lineStartTs`, `lastEventTs`, `lastPly`) so durationMs can
 *     be computed without the page-side bookkeeping
 *
 * Writes are scheduled via `queueMicrotask` so the IDB `append` never blocks
 * the React render path.
 */

import { useCallback, useEffect, useRef } from 'react';
import { getEventsRepository } from '../storage';
import type { EventType, SessionEvent } from '../types/events';

export interface UseEventEmitterReturn {
  /** Record an event. `plyIndex` is required for move/hint events, optional
   *  for line_complete (defaulted to the last recorded ply if omitted). */
  emit: (eventType: EventType, plyIndex?: number) => void;
}

/**
 * @param activeLineId stable line slug or null. On change, prior session is
 *   abandoned (if not completed) and a new `line_start` is emitted.
 */
export function useEventEmitter(activeLineId: string | null): UseEventEmitterReturn {
  const lineStartTsRef = useRef<number | null>(null);
  const lastEventTsRef = useRef<number | null>(null);
  const lastPlyRef = useRef<number | null>(null);
  const lastEventTypeRef = useRef<EventType | null>(null);
  const activeLineRef = useRef<string | null>(null);

  const writeEvent = useCallback(
    (ev: Omit<SessionEvent, 'id'>): void => {
      queueMicrotask(() => {
        getEventsRepository()
          .append(ev)
          .catch((err) => console.error('Event append failed:', err));
      });
    },
    []
  );

  const emit = useCallback(
    (eventType: EventType, plyIndex?: number): void => {
      const lineId = activeLineRef.current;
      if (lineId === null) return; // no active line — drop silently
      const now = Date.now();
      let durationMs: number | null = null;
      let ply: number | null = plyIndex ?? null;

      if (eventType === 'line_start') {
        durationMs = null;
      } else if (eventType === 'line_complete' || eventType === 'line_abandoned') {
        durationMs =
          lineStartTsRef.current !== null ? now - lineStartTsRef.current : null;
        if (ply === null) ply = lastPlyRef.current;
      } else if (eventType === 'hint_used') {
        durationMs = null;
      } else {
        // move_correct / move_wrong
        durationMs =
          lastEventTsRef.current !== null ? now - lastEventTsRef.current : null;
      }

      if (ply !== null) lastPlyRef.current = ply;
      lastEventTsRef.current = now;
      lastEventTypeRef.current = eventType;

      writeEvent({ timestamp: now, eventType, lineId, plyIndex: ply, durationMs });
    },
    [writeEvent]
  );

  useEffect(() => {
    if (activeLineId === null) {
      activeLineRef.current = null;
      lineStartTsRef.current = null;
      lastEventTsRef.current = null;
      lastPlyRef.current = null;
      lastEventTypeRef.current = null;
      return;
    }

    // Activate: seed refs and emit line_start.
    const now = Date.now();
    activeLineRef.current = activeLineId;
    lineStartTsRef.current = now;
    lastEventTsRef.current = now;
    lastPlyRef.current = null;
    lastEventTypeRef.current = 'line_start';
    writeEvent({
      timestamp: now,
      eventType: 'line_start',
      lineId: activeLineId,
      plyIndex: null,
      durationMs: null,
    });

    // Cleanup: emit line_abandoned unless the session already completed.
    return () => {
      if (
        lastEventTypeRef.current !== 'line_complete' &&
        lastEventTypeRef.current !== 'line_abandoned' &&
        activeLineRef.current !== null
      ) {
        const cleanupTs = Date.now();
        const durationMs =
          lineStartTsRef.current !== null ? cleanupTs - lineStartTsRef.current : null;
        writeEvent({
          timestamp: cleanupTs,
          eventType: 'line_abandoned',
          lineId: activeLineRef.current,
          plyIndex: lastPlyRef.current,
          durationMs,
        });
      }
      activeLineRef.current = null;
    };
  }, [activeLineId, writeEvent]);

  return { emit };
}
