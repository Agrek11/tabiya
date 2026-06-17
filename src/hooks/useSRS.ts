/**
 * useSRS — single React hook for reading SRS state.
 *
 * Loads all states once on mount via `listAllStates()`, derives `dueLineIds`
 * from the current map using `scheduler.isDue`. No polling. Exposes a manual
 * `refresh()` callback so post-drill navigation back to a list page sees
 * fresh data.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSrsRepository } from '../storage';
import { isDue } from '../storage/srs/scheduler';
import type { SrsState } from '../storage/types';

type UseSrsReturn = {
  states: Map<string, SrsState>;
  dueLineIds: string[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

export function useSRS(): UseSrsReturn {
  const [states, setStates] = useState<Map<string, SrsState>>(() => new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const all = await getSrsRepository().listAllStates();
      const map = new Map<string, SrsState>();
      for (const s of all) map.set(s.line_id, s);
      setStates(map);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load. `loading` already starts true, so we do NOT call the
  // synchronous setLoading(true) inside `refresh` here — that would be a
  // setState-in-effect cascade. We fetch directly and commit only in the async
  // continuation, guarded by a cancelled flag (matches OOBWidget/AISection).
  useEffect(() => {
    let cancelled = false;
    void getSrsRepository()
      .listAllStates()
      .then((all) => {
        if (cancelled) return;
        const map = new Map<string, SrsState>();
        for (const s of all) map.set(s.line_id, s);
        setStates(map);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dueLineIds = useMemo(() => {
    const now = new Date();
    return Array.from(states.values())
      .filter((s) => isDue(s, now))
      .map((s) => s.line_id);
  }, [states]);

  return { states, dueLineIds, loading, error, refresh };
}
