/**
 * useKeySquareOverlay — Phase 2b Pattern Viz visibility logic (R7).
 *
 * Owns the rule that decides whether the spotlight overlay is rendered:
 *   visible = hasKeySquares && (explainModeActive || drillPreference)
 *
 * Drill preference persists per-line in localStorage under
 *   `tabiya:linePrefs:<lineId>:keySquareOverlay`
 * matching the Phase 1b mode-pref convention (`useLinePrefMode`).
 *
 * Explain Mode integration (R7.3, R7.4): when the user is inside Explain
 * Mode, the overlay is forced on regardless of the drill toggle. Exiting
 * Explain restores the drill toggle's persisted value. The caller passes
 * `explainModeActive: boolean` — true while Explain Mode is the active
 * mode for the line. Forcing is automatic; DrillPage does not branch.
 *
 * Graceful degrade (R7.5): when the active opening has no curated
 * `key_squares`, the toggle is reported as disabled and `visible` is
 * always false. Caller hides the toggle UI in that case.
 *
 * Article 11 (local-first): localStorage only.
 * Article 14 (type discipline): strict, no `any`.
 */

import { useCallback, useEffect, useState } from 'react';

const KEY_PREFIX = 'tabiya:linePrefs:';
const KEY_SUFFIX = ':keySquareOverlay';

function storageKey(lineId: string): string {
  return `${KEY_PREFIX}${lineId}${KEY_SUFFIX}`;
}

function readPref(lineId: string | null): boolean {
  if (lineId === null) return false;
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(storageKey(lineId)) === 'true';
  } catch {
    return false;
  }
}

function writePref(lineId: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(lineId), value ? 'true' : 'false');
  } catch {
    /* quota / private mode */
  }
}

export interface UseKeySquareOverlayArgs {
  /** Stable line ID for the per-line persistence key. Null while loading. */
  lineId: string | null;
  /** True when the active opening has curated key-square data. */
  hasKeySquares: boolean;
  /** True while Explain Mode is the active mode for this line. */
  explainModeActive: boolean;
}

export interface UseKeySquareOverlayReturn {
  /** Render the overlay right now? false when no data. */
  visible: boolean;
  /** User's persisted drill-mode preference (ignored while in Explain). */
  drillPreference: boolean;
  /** Toggle is disabled (hide it in UI) when no curated data. */
  toggleDisabled: boolean;
  /** Flip the drill-mode preference + persist. No-op when disabled. */
  toggle(): void;
}

export function useKeySquareOverlay({
  lineId,
  hasKeySquares,
  explainModeActive,
}: UseKeySquareOverlayArgs): UseKeySquareOverlayReturn {
  const [drillPref, setDrillPref] = useState<boolean>(() => readPref(lineId));

  // Re-sync on lineId change — each line has its own preference.
  useEffect(() => {
    setDrillPref(readPref(lineId));
  }, [lineId]);

  const toggle = useCallback((): void => {
    if (!hasKeySquares) return;
    if (lineId === null) return;
    const next = !drillPref;
    setDrillPref(next);
    writePref(lineId, next);
  }, [drillPref, hasKeySquares, lineId]);

  const toggleDisabled = !hasKeySquares;
  // R7.3 + R7.4: Explain forces on; otherwise the drill toggle decides.
  const visible = hasKeySquares && (explainModeActive || drillPref);

  return {
    visible,
    drillPreference: drillPref,
    toggleDisabled,
    toggle,
  };
}
