/**
 * useStreaks — React surface over `computeStreaks`.
 *
 * On mount and on every bus publish, reads `listAll()` and pipes through
 * `computeStreaks(events, new Date())`. The bus already rAF-coalesces, so a
 * 6-move drill triggers one recompute, not six.
 */

import { useEffect, useState } from 'react';
import { getEventsBus, getEventsRepository } from '../storage';
import {
  computeStreaks,
  EMPTY_STREAKS,
  type StreaksResult,
} from './streaks/computeStreaks';

export function useStreaks(): StreaksResult {
  const [result, setResult] = useState<StreaksResult>(EMPTY_STREAKS);

  useEffect(() => {
    let cancelled = false;
    const recompute = async (): Promise<void> => {
      try {
        const events = await getEventsRepository().listAll();
        if (cancelled) return;
        setResult(computeStreaks(events, new Date()));
      } catch (err) {
        console.error('useStreaks recompute failed:', err);
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
