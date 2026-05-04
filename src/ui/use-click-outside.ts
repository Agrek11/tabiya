import { useEffect, useRef, type RefObject } from 'react';

/**
 * Closes a popover/dropdown when a pointerdown lands outside the wrapped node.
 * Pass `enabled=true` only while the popover is open. The callback should
 * close the popover (e.g. setOpen(false)).
 */
export function useClickOutside<T extends HTMLElement>(
  enabled: boolean,
  onOutside: () => void
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: PointerEvent): void => {
      const node = ref.current;
      if (node && !node.contains(e.target as Node)) onOutside();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [enabled, onOutside]);
  return ref;
}
