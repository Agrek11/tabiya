/**
 * useSidebarCollapsed — persisted boolean for desktop sidebar collapse state.
 *
 * Backed by localStorage key `tabiya.sidebarCollapsed`. Default expanded.
 * SSR-safe (returns false when window undefined).
 */

import { useState, useCallback } from 'react';

const KEY = 'tabiya.sidebarCollapsed';

export function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
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
