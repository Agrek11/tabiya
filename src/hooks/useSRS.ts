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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dueLineIds = useMemo(() => {
    const now = new Date();
    return Array.from(states.values())
      .filter((s) => isDue(s, now))
      .map((s) => s.line_id);
  }, [states]);

  return { states, dueLineIds, loading, error, refresh };
}
