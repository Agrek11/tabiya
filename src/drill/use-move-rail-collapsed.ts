/**
 * useMoveRailCollapsed — persisted boolean toggle for the drill move-history rail.
 *
 * Backed by localStorage key `tabiya.moveRailCollapsed`. Default expanded.
 * SSR-safe (returns false when window undefined).
 */

import { useState, useCallback } from 'react';

const KEY = 'tabiya.moveRailCollapsed';

export function useMoveRailCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });

  const setCollapsed = useCallback((v: boolean): void => {
    setCollapsedState(v);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      /* quota / private mode */
    }
  }, []);

  return [collapsed, setCollapsed];
}
