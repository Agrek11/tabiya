/**
 * useExplainTts — Phase 1b Web Speech wrapper for Explain Mode (R6).
 *
 * Speaks per-ply rationale via the browser's `SpeechSynthesisUtterance`.
 * Feature-flagged (`tabiya:flag:explainTts`, default off) and per-line
 * mutable (`tabiya:linePrefs:<lineId>:ttsMute`). Older browsers without
 * `window.speechSynthesis` no-op cleanly.
 *
 * Article 11 (local-first): browser-native API, no network call. Article 14:
 * strict TS, no `any`.
 *
 * v1 scope: defaults only — no voice / rate / pitch tuning (deferred to 1b.3).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getExplainTtsFlag } from '../storage/featureFlags';

const PER_LINE_KEY_PREFIX = 'tabiya:linePrefs:';
const PER_LINE_KEY_SUFFIX = ':ttsMute';

function lineMuteKey(lineId: string): string {
  return `${PER_LINE_KEY_PREFIX}${lineId}${PER_LINE_KEY_SUFFIX}`;
}

function readLineMute(lineId: string | null): boolean {
  if (lineId === null) return false;
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(lineMuteKey(lineId)) === 'true';
  } catch {
    return false;
  }
}

function writeLineMute(lineId: string, muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(lineMuteKey(lineId), muted ? 'true' : 'false');
  } catch {
    /* private mode / quota — silently degrade */
  }
}

function detectAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined' &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  );
}

export type UseExplainTtsArgs = {
  lineId: string | null;
  paused: boolean;
};

export type UseExplainTtsReturn = {
  speak(text: string): void;
  cancel(): void;
  /** True when `window.speechSynthesis` is present in this environment. */
  available: boolean;
  /** True when global flag is on AND not muted for the current line. */
  enabled: boolean;
  /** Global flag state — used for showing the speaker icon at all. */
  globalEnabled: boolean;
  /** Per-line mute state. */
  mutedForLine: boolean;
  toggleLineMute(): void;
};

export function useExplainTts({ lineId, paused }: UseExplainTtsArgs): UseExplainTtsReturn {
  const [available] = useState<boolean>(() => detectAvailable());
  const [globalEnabled, setGlobalEnabled] = useState<boolean>(() => getExplainTtsFlag());
  const [mutedForLine, setMutedForLine] = useState<boolean>(() => readLineMute(lineId));

  // Re-sync globalEnabled / mutedForLine when relevant inputs change. We
  // intentionally re-read on every lineId change rather than subscribing to
  // localStorage (storage events fire across tabs only); the Settings page
  // is the only place that mutates the global flag and consumers re-mount
  // when they need a fresh read.
  useEffect(() => {
    setGlobalEnabled(getExplainTtsFlag());
    setMutedForLine(readLineMute(lineId));
  }, [lineId]);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const cancel = useCallback((): void => {
    if (!available) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* defensive — some browsers throw if engine not ready */
    }
    utteranceRef.current = null;
  }, [available]);

  const enabled = available && globalEnabled && !mutedForLine;

  const speak = useCallback(
    (text: string): void => {
      if (!enabled) return;
      if (paused) return;
      if (text.length === 0) return;
      cancel();
      try {
        const u = new window.SpeechSynthesisUtterance(text);
        utteranceRef.current = u;
        window.speechSynthesis.speak(u);
      } catch {
        /* engine error — silently no-op (Article 11 graceful degrade) */
      }
    },
    [enabled, paused, cancel],
  );

  const toggleLineMute = useCallback((): void => {
    if (lineId === null) return;
    setMutedForLine((cur) => {
      const next = !cur;
      writeLineMute(lineId, next);
      // If muting while speaking, stop the current utterance.
      if (next) cancel();
      return next;
    });
  }, [lineId, cancel]);

  // Cleanup on unmount — never leak a speaking utterance.
  useEffect(() => () => cancel(), [cancel]);

  return {
    speak,
    cancel,
    available,
    enabled,
    globalEnabled,
    mutedForLine,
    toggleLineMute,
  };
}
