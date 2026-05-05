/**
 * useDrillHistoryOpen — persisted boolean for the right-rail move-history.
 *
 * Backed by localStorage key `tabiya.drillHistoryOpen`. Default OPEN
 * (v1.3 wireframe: history is a sticky right rail with its own column —
 * vertical space is not contested, so default to visible). SSR-safe.
 *
 * Persistence convention: '1' = open, '0' = closed. Absent = open.
 */

import { useState, useCallback } from 'react';

const KEY = 'tabiya.drillHistoryOpen';

export function useDrillHistoryOpen(): [boolean, (v: boolean) => void] {
  const [open, setOpenState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      // Absent or '1' → open. Only an explicit '0' closes it.
      return window.localStorage.getItem(KEY) !== '0';
    } catch {
      return true;
    }
  });

  const setOpen = useCallback((v: boolean): void => {
    setOpenState(v);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      /* quota / private mode */
    }
  }, []);

  return [open, setOpen];
}
