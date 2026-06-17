/**
 * useLinePrefMode — per-line drill/explain mode preference (R1).
 *
 * Storage key: `tabiya:linePrefs:<lineId>:mode` → `"drill" | "explain"`.
 * Absent or malformed → default "drill". Each lineId carries its own key —
 * switching lines preserves each line's chosen mode independently.
 *
 * Article 11 (local-first): localStorage only, no network. Article 14
 * (type discipline): strict, no `any`.
 */

import { useCallback, useState } from 'react';

export type ExplainModeChoice = 'drill' | 'explain';

const KEY_PREFIX = 'tabiya:linePrefs:';
const KEY_SUFFIX = ':mode';

function modeKey(lineId: string): string {
  return `${KEY_PREFIX}${lineId}${KEY_SUFFIX}`;
}

function readMode(lineId: string | null): ExplainModeChoice {
  if (lineId === null) return 'drill';
  if (typeof window === 'undefined') return 'drill';
  try {
    const v = window.localStorage.getItem(modeKey(lineId));
    return v === 'explain' ? 'explain' : 'drill';
  } catch {
    return 'drill';
  }
}

function writeMode(lineId: string, mode: ExplainModeChoice): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(modeKey(lineId), mode);
  } catch {
    /* quota / private mode */
  }
}

export function useLinePrefMode(
  lineId: string | null,
): [ExplainModeChoice, (mode: ExplainModeChoice) => void] {
  const [mode, setMode] = useState<ExplainModeChoice>(() => readMode(lineId));

  // Re-sync on lineId change. Done during render (not in an effect) per the
  // "adjusting state when a prop changes" pattern — avoids the extra commit +
  // cascading render an effect-based reset would cause.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevLineId, setPrevLineId] = useState(lineId);
  if (prevLineId !== lineId) {
    setPrevLineId(lineId);
    setMode(readMode(lineId));
  }

  const set = useCallback(
    (next: ExplainModeChoice): void => {
      if (lineId === null) {
        setMode(next);
        return;
      }
      setMode(next);
      writeMode(lineId, next);
    },
    [lineId],
  );

  return [mode, set];
}
