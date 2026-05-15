/**
 * EventsContext — single events fan-out per dashboard / repertoire page mount.
 *
 * Owns one `listAll()` and recomputes a per-line `AggregateResult` map. Hooks
 * like `useLineAccuracy` read from this context to avoid N+1 IDB reads when
 * N=50 line rows render simultaneously.
 *
 * Subscribes to the events bus so a single drill session's burst of writes
 * triggers exactly one fan-out recompute (the bus rAF-coalesces).
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getEventsBus, getEventsRepository } from '../storage';
import { emptyAggregate, type AggregateResult, type SessionEvent } from '../types/events';
import { tally } from '../storage/events/IndexedDbEventsRepository';

interface EventsContextValue {
  events: SessionEvent[];
  perLineAggregates: Map<string, AggregateResult>;
  isLoading: boolean;
}

const EventsContext = createContext<EventsContextValue>({
  events: [],
  perLineAggregates: new Map(),
  isLoading: true,
});

export function EventsContextProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const recompute = async (): Promise<void> => {
      try {
        const next = await getEventsRepository().listAll();
        if (cancelled) return;
        setEvents(next);
        setIsLoading(false);
      } catch (err) {
        console.error('EventsContext recompute failed:', err);
        if (!cancelled) setIsLoading(false);
      }
    };
    void recompute();
    const unsubscribe = getEventsBus().subscribe(() => void recompute());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const perLineAggregates = useMemo(() => {
    const byLine = new Map<string, SessionEvent[]>();
    for (const e of events) {
      const arr = byLine.get(e.lineId) ?? [];
      arr.push(e);
      byLine.set(e.lineId, arr);
    }
    const out = new Map<string, AggregateResult>();
    for (const [lineId, list] of byLine) {
      out.set(lineId, tally(list, {}));
    }
    return out;
  }, [events]);

  const value = useMemo<EventsContextValue>(
    () => ({ events, perLineAggregates, isLoading }),
    [events, perLineAggregates, isLoading]
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEventsContext(): EventsContextValue {
  return useContext(EventsContext);
}

/** Read a per-line aggregate from the context. Returns an empty aggregate
 *  if the line has no events yet — never throws. */
export function useLineAggregateFromContext(lineId: string): AggregateResult {
  const { perLineAggregates } = useEventsContext();
  return perLineAggregates.get(lineId) ?? emptyAggregate();
}
